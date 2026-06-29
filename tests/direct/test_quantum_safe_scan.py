"""Fast tests for deterministic QuantumSafeScan contract logic.

The GenLayer direct runner currently fails before contract execution on this
Windows setup because its stdin temp file cannot be unlinked while open. These
tests still keep the scoring, URL normalization, and view serialization logic
covered without calling the direct runner.
"""

import importlib.util
import json
import sys
import types
from pathlib import Path


class _TreeMap(dict):
    def __class_getitem__(cls, _item):
        return cls


class _Address(str):
    pass


class _U256(int):
    pass


class _Public:
    def write(self, fn):
        return fn

    def view(self, fn):
        return fn


class _Gl:
    Contract = object
    public = _Public()

    class vm:
        class UserError(Exception):
            pass


def _allow_storage(cls):
    return cls


def _load_contract_module():
    genlayer_stub = types.ModuleType("genlayer")
    genlayer_stub.TreeMap = _TreeMap
    genlayer_stub.Address = _Address
    genlayer_stub.u256 = _U256
    genlayer_stub.gl = _Gl
    genlayer_stub.allow_storage = _allow_storage
    sys.modules["genlayer"] = genlayer_stub

    contract_path = Path(__file__).parents[2] / "contracts" / "quantum_safe_scan.py"
    spec = importlib.util.spec_from_file_location("quantum_safe_scan_test", contract_path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def _contract():
    module = _load_contract_module()
    return object.__new__(module.QuantumSafeScan)


def test_normalizes_github_repo_url():
    contract = _contract()

    assert (
        contract._normalize_github_url("https://www.github.com/example/repo/issues/1")
        == "https://github.com/example/repo"
    )
    assert (
        contract._normalize_github_url("https://github.com/example/repo?tab=readme")
        == "https://github.com/example/repo"
    )


def test_rejects_non_github_https_url():
    contract = _contract()

    try:
        contract._normalize_github_url("http://github.com/example/repo")
    except Exception as exc:
        assert "Only public GitHub HTTPS repo URLs are supported" in str(exc)
    else:
        raise AssertionError("Expected invalid URL to raise")


def test_scores_low_risk_analysis():
    contract = _contract()
    analysis = {
        "readme_present": True,
        "security_policy_present": True,
        "risky_old_crypto_terms": [],
        "post_quantum_terms": ["Kyber", "ML-KEM"],
        "secret_like_terms": [],
        "evidence_quality": "ENOUGH",
    }

    score = contract._score(analysis)

    assert score == 100
    assert contract._risk_level(score) == "LOW"


def test_scores_high_risk_analysis():
    contract = _contract()
    analysis = {
        "readme_present": False,
        "security_policy_present": False,
        "risky_old_crypto_terms": ["MD5", "SHA1", "DES"],
        "post_quantum_terms": [],
        "secret_like_terms": ["api_key", "private_key"],
        "evidence_quality": "WEAK",
    }

    score = contract._score(analysis)

    assert score == 30
    assert contract._risk_level(score) == "HIGH"


def test_recommended_fixes_prioritize_detected_gaps():
    contract = _contract()
    analysis = {
        "security_policy_present": False,
        "risky_old_crypto_terms": ["MD5"],
        "post_quantum_terms": [],
        "secret_like_terms": ["api_key"],
        "evidence_quality": "WEAK",
    }

    fixes = contract._recommended_fixes(analysis)

    assert len(fixes) == 3
    assert "SECURITY.md" in fixes[0]
    assert "weak crypto" in fixes[1]
    assert "secret-like" in fixes[2]


def test_scan_view_serializes_storage_result():
    module = _load_contract_module()
    contract = object.__new__(module.QuantumSafeScan)
    scan = module.ScanResult(
        id="1",
        submitted_by="0xabc",
        target_url="https://github.com/example/repo",
        score=module.u256(85),
        risk_level="LOW",
        verdict="Ready enough for MVP review.",
        evidence_summary="README and SECURITY.md found.",
        recommended_fixes_json=json.dumps(["Add dependency policy"]),
        block_info="scan_index:1",
    )

    serialized = contract._scan_to_dict(scan)

    assert serialized["score"] == 85
    assert serialized["recommended_fixes"] == ["Add dependency policy"]
    assert serialized["block_info"] == "scan_index:1"

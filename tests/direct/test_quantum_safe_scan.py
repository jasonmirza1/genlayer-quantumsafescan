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


class _Return:
    def __init__(self, calldata):
        self.calldata = calldata


class _Vm:
    Return = _Return

    class UserError(Exception):
        pass

    @staticmethod
    def run_nondet_unsafe(leader_fn, validator_fn):
        leader_value = leader_fn()
        assert validator_fn(_Return(leader_value))
        return leader_value


class _Web:
    @staticmethod
    def render(_url, mode="text"):
        assert mode == "text"
        return "README SECURITY.md ML-KEM"


class _Nondet:
    web = _Web()

    @staticmethod
    def exec_prompt(_task, response_format=None):
        assert response_format == "json"
        assert "untrusted evidence" in _task
        assert "Do not flag examples" in _task
        return {
            "readme_present": True,
            "security_policy_present": True,
            "risky_old_crypto_terms": [],
            "post_quantum_terms": ["ML-KEM"],
            "secret_like_terms": [],
            "evidence_quality": "ENOUGH",
        }


class _EqPrinciple:
    @staticmethod
    def prompt_comparative(leader_fn, principle):
        assert "materially equivalent" in principle
        return leader_fn()


class _Gl:
    Contract = object
    public = _Public()
    vm = _Vm
    nondet = _Nondet()
    eq_principle = _EqPrinciple()


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


def test_nondeterministic_analysis_validates_stable_decisions():
    contract = _contract()

    analysis = contract._analyze_public_evidence(
        "https://github.com/example/repo"
    )

    assert analysis["readme_present"] is True
    assert analysis["security_policy_present"] is True
    assert analysis["post_quantum_terms"] == ["ML-KEM"]


def test_verdict_and_summary_are_derived_from_validated_signals():
    contract = _contract()
    analysis = {
        "readme_present": True,
        "security_policy_present": False,
        "risky_old_crypto_terms": ["SHA1"],
        "post_quantum_terms": [],
        "secret_like_terms": [],
        "evidence_quality": "ENOUGH",
    }
    score = contract._score(analysis)
    risk_level = contract._risk_level(score)

    summary = contract._evidence_summary(analysis)
    verdict = contract._verdict(score, risk_level, analysis)

    assert "security policy not found" in summary
    assert "legacy crypto references found" in summary
    assert f"{risk_level} risk ({score}/100)" in verdict


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

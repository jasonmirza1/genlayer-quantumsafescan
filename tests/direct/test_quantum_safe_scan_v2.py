"""Offline regression tests. SDK-backed execution is tested separately in tests/sdk."""

import copy
import hashlib
import importlib.util
import json
import re
import sys
import types
from pathlib import Path

import pytest


SHA = "a" * 40
NONCE = "b" * 32
ALICE = "0x" + "1" * 40
BOB = "0x" + "2" * 40
TEXT = (
    "# Selected repository evidence\n"
    "This project documents public security controls for review; no safety certification is claimed.\n"
    "Report security vulnerabilities privately through the repository security advisory channel.\n"
    "Our concrete post-quantum migration plan inventories long-lived keys before an ML-KEM transition.\n"
)
FINDING = {"category": "PQC_MIGRATION", "subject": "MIGRATION_PLAN", "path": "README.md", "start_line": 4, "end_line": 4}
ANSWER = {"uncertain": False, "findings": [FINDING]}


class Address(str):
    def __new__(cls, value):
        if not re.fullmatch(r"0x[0-9a-fA-F]{40}", value):
            raise ValueError("Invalid address")
        return super().__new__(cls, value.lower())

    @property
    def as_hex(self):
        return str(self)


class TreeMap(dict):
    def __class_getitem__(cls, item):
        return cls


class Return:
    def __init__(self, calldata):
        self.calldata = calldata


class UserError(Exception):
    pass


@pytest.fixture
def module():
    gl = types.ModuleType("genlayer")
    gl.contract = types.SimpleNamespace(Contract=object)
    gl.storage = types.SimpleNamespace(TreeMap=TreeMap)
    gl.Address, gl.u256 = Address, int
    gl.public = types.SimpleNamespace(write=lambda fn: fn, view=lambda fn: fn)
    gl.message = types.SimpleNamespace(sender_address=Address(ALICE))
    gl.responses, gl.answer, gl.fetch_calls, gl.prompt_calls = {}, copy.deepcopy(ANSWER), [], []

    def get(url):
        gl.fetch_calls.append(url)
        response = gl.responses[url]
        if isinstance(response, Exception):
            raise response
        return response

    def prompt(task, response_format=None):
        gl.prompt_calls.append(task)
        assert response_format == "json"
        assert "untrusted evidence" in task
        assert "Do not flag examples" in task
        if isinstance(gl.answer, Exception):
            raise gl.answer
        return copy.deepcopy(gl.answer)

    def run_nondet(collect, validate):
        result = collect()
        gl.leader, gl.validator = copy.deepcopy(result), validate
        if not validate(Return(result)):
            raise UserError("Consensus disagreed")
        return result

    gl.nondet = types.SimpleNamespace(web=types.SimpleNamespace(get=get), exec_prompt=prompt)
    gl.vm = types.SimpleNamespace(UserError=UserError, Return=Return, run_nondet=run_nondet)
    previous = sys.modules.get("genlayer")
    sys.modules["genlayer"] = gl
    try:
        path = Path(__file__).parents[2] / "contracts/quantum_safe_scan_v2.py"
        spec = importlib.util.spec_from_file_location("quantum_safe_scan_v2_test", path)
        loaded = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(loaded)
    finally:
        if previous is None:
            sys.modules.pop("genlayer", None)
        else:
            sys.modules["genlayer"] = previous
    return loaded


@pytest.fixture
def contract(module):
    result = module.QuantumSafeScanV2()
    result.scans, result.latest_scan_by_user, result.used_nonces, result.scan_count = {}, {}, {}, 0
    return result


def manifest(text=TEXT, path="README.md", **changes):
    return {"repository": "https://github.com/example/repo", "commit": SHA, "files": [{"path": path, "sha256": hashlib.sha256(text.encode()).hexdigest()}], **changes}


def mock_files(contract, module, value=None, body=TEXT.encode(), status=200):
    value = value or manifest()
    value = contract._manifest(json.dumps(value))
    for row in value["files"]:
        module.gl.responses[contract._raw_url(value, row["path"])] = types.SimpleNamespace(body=body, status=status)
    return value


def review(contract, module, value=None):
    value = mock_files(contract, module, value)
    receipts, texts = contract._fetch_files(value)
    return contract._review(receipts, texts), texts, value


def test_pinned_review_is_grounded_and_persistent(contract, module):
    value = mock_files(contract, module)
    scan = contract.submit_scan(json.dumps(value), NONCE)
    assert scan["version"] == 2 and scan["status"] == "REVIEWED"
    assert scan["evidence_verified"] is True
    assert scan["scope"] == "SELECTED_FILES_ONLY"
    assert scan["score"] == 85
    assert scan["files"][0]["observed_sha256"] == value["files"][0]["sha256"]
    assert scan["findings"][0]["quote_sha256"] == hashlib.sha256(TEXT.splitlines(keepends=True)[3].encode()).hexdigest()
    assert contract.get_scan("1") == scan == contract.get_latest_scan(ALICE)
    assert contract.get_scan_count() == 1 and contract.get_config()["version"] == 2
    assert len(module.gl.fetch_calls) == 2  # leader and independent validator


@pytest.mark.parametrize("repo", ["http://github.com/a/b", "https://evil.com/a/b", "https://github.com/a/b/tree/main", "https://github.com/a/b?x=1", "https://github.com/a/b#x", "https://github.com/a/..", "https://github.com/a/b/", "https://github.com@evil.com/a/b", "https://www.github.com/a/b", "https://github.com/a/b%2fc", "https://github.com/a\\b/c", "https://github.com/a/b.git?ref=main"])
def test_rejects_noncanonical_repository(contract, repo):
    with pytest.raises(UserError):
        contract._manifest(json.dumps(manifest(repository=repo)))


@pytest.mark.parametrize("commit", ["main", "a" * 7, "a" * 39, "a" * 41, "A" * 40, "g" * 40, None, 123])
def test_requires_full_lowercase_commit(contract, commit):
    with pytest.raises(UserError):
        contract._manifest(json.dumps(manifest(commit=commit)))


@pytest.mark.parametrize("path", ["../secret", "/README.md", "a/../b", "a//b", "a/./b", "a\\b", "README.md?x=1", "README.md#x", "a/%2e%2e/b", ".", "..", "a b.md", "a/", "x" * 181, "é.md"])
def test_rejects_unsafe_file_paths(contract, path):
    with pytest.raises(UserError):
        contract._manifest(json.dumps(manifest(path=path)))


@pytest.mark.parametrize("digest", ["0" * 63, "0" * 65, "F" * 64, "g" * 64, None, 1])
def test_requires_exact_file_sha256(contract, digest):
    value = manifest()
    value["files"][0]["sha256"] = digest
    with pytest.raises(UserError):
        contract._manifest(json.dumps(value))


def test_rejects_duplicate_keys_files_extras_and_limits(contract):
    value = manifest()
    for raw in [
        '{"repository":"https://github.com/a/b","repository":"https://github.com/a/c","commit":"' + SHA + '","files":[]}',
        json.dumps({**value, "extra": 1}),
        json.dumps({**value, "files": []}),
        json.dumps({**value, "files": value["files"] * 2}),
        json.dumps({**value, "files": [{**value["files"][0], "extra": True}]}),
        "[1]", "not JSON", " " * 4001,
        json.dumps({**value, "files": [{"path": str(index), "sha256": "a" * 64} for index in range(6)]}),
    ]:
        with pytest.raises(UserError):
            contract._manifest(raw)


def test_manifest_order_is_canonical(contract):
    value = manifest(files=[{"path": "z.md", "sha256": "a" * 64}, {"path": ".github/SECURITY.md", "sha256": "b" * 64}])
    assert contract._manifest(json.dumps(value))["files"][0]["path"] == ".github/SECURITY.md"


@pytest.mark.parametrize("body,status,expected", [
    (b"", 200, "EMPTY"), (None, 200, "EMPTY"), (TEXT, 200, "EMPTY"),
    (b"missing", 404, "HTTP_ERROR"), (b"blocked", 503, "HTTP_ERROR"),
    (b"x" * 8001, 200, "TOO_LARGE"), (b"changed", 200, "HASH_MISMATCH"),
])
def test_unavailable_evidence_is_never_scored(contract, module, body, status, expected):
    value = mock_files(contract, module, body=body, status=status)
    result = contract.submit_scan(json.dumps(value), NONCE)
    assert result["status"] == "INCONCLUSIVE" and result["score"] is None
    assert result["risk_level"] == "UNASSESSED"
    assert result["files"][0]["status"] == expected
    assert result["findings"] == [] and module.gl.prompt_calls == []


def test_fetch_exception_is_recorded_without_leaking_message(contract, module):
    value = mock_files(contract, module)
    module.gl.responses[contract._raw_url(value, "README.md")] = RuntimeError("private internals")
    result = contract.submit_scan(json.dumps(value), NONCE)
    assert result["files"][0]["status"] == "FETCH_ERROR"
    assert "private internals" not in json.dumps(result)


@pytest.mark.parametrize("body", [b"hello\x00world" + b"a" * 100, b"\xff" * 120])
def test_verified_binary_or_invalid_utf8_is_inconclusive(contract, module, body):
    value = manifest()
    value["files"][0]["sha256"] = hashlib.sha256(body).hexdigest()
    mock_files(contract, module, value, body=body)
    result = contract.submit_scan(json.dumps(value), NONCE)
    assert result["files"][0]["status"] == "INVALID_TEXT"
    assert result["score"] is None


def test_total_byte_limit_does_not_truncate(contract, module):
    body = b"a" * 7000
    value = manifest(files=[{"path": f"file{index}.md", "sha256": hashlib.sha256(body).hexdigest()} for index in range(4)])
    mock_files(contract, module, value, body=body)
    scan = contract.submit_scan(json.dumps(value), NONCE)
    assert scan["status"] == "INCONCLUSIVE" and scan["files"][-1]["status"] == "TOTAL_LIMIT"
    assert module.gl.prompt_calls == []


def test_one_missing_file_fails_whole_selection(contract, module):
    value = manifest(files=[manifest()["files"][0], {"path": "SECURITY.md", "sha256": "0" * 64}])
    mock_files(contract, module, value)
    module.gl.responses[contract._raw_url(value, "SECURITY.md")] = types.SimpleNamespace(status=404, body=b"not found")
    scan = contract.submit_scan(json.dumps(value), NONCE)
    assert scan["files"][0]["status"] == "VERIFIED"
    assert not scan["evidence_verified"] and scan["score"] is None
    assert module.gl.prompt_calls == []


def test_thin_valid_evidence_has_no_score(contract, module):
    value = manifest(text="tiny")
    mock_files(contract, module, value, body=b"tiny")
    scan = contract.submit_scan(json.dumps(value), NONCE)
    assert scan["reason"] == "EVIDENCE_TOO_THIN" and scan["evidence_verified"]
    assert scan["score"] is None and module.gl.prompt_calls == []


@pytest.mark.parametrize("raw", [None, "not json", {}, {"uncertain": "false", "findings": []}, {"uncertain": False, "findings": [], "score": 100}, {"uncertain": False, "findings": {}}, {"uncertain": False, "findings": [FINDING] * 13}])
def test_malformed_model_output_fails_closed(contract, module, raw):
    value = mock_files(contract, module)
    module.gl.answer = raw
    scan = contract.submit_scan(json.dumps(value), NONCE)
    assert scan["reason"] == "ANALYSIS_INVALID" and scan["score"] is None


@pytest.mark.parametrize("change", [{"category": "SAFE"}, {"subject": "UNKNOWN"}, {"path": "invented.md"}, {"start_line": True}, {"start_line": 0}, {"end_line": 99}, {"end_line": 0}, {"quote": "made up"}, {"start_line": 1, "end_line": 1}])
def test_ungrounded_model_findings_fail_closed(contract, module, change):
    value = mock_files(contract, module)
    module.gl.answer = {"uncertain": False, "findings": [{**FINDING, **change}]}
    scan = contract.submit_scan(json.dumps(value), NONCE)
    assert scan["reason"] == "ANALYSIS_INVALID" and scan["score"] is None


def test_uncertainty_or_model_failure_has_no_score(contract, module):
    value = mock_files(contract, module)
    for answer, reason, nonce in [({"uncertain": True, "findings": []}, "ANALYSIS_UNCERTAIN", NONCE), (RuntimeError("model failed"), "ANALYSIS_UNAVAILABLE", "c" * 32)]:
        module.gl.answer = answer
        scan = contract.submit_scan(json.dumps(value), nonce)
        assert scan["reason"] == reason and scan["score"] is None


@pytest.mark.parametrize("field", ["path", "url", "expected_sha256", "observed_sha256", "byte_length", "status", "scope"])
def test_validator_rejects_tampered_receipts(contract, module, field):
    result, texts, value = review(contract, module)
    leader = copy.deepcopy(result)
    leader["files"][0][field] = 77 if field == "byte_length" else "tampered"
    assert contract._agree(leader, result, value, texts) is False


def test_validator_rejects_changed_bytes_or_missing_findings(contract, module):
    result, texts, value = review(contract, module)
    for mutate in [lambda row: row.update(findings=[]), lambda row: row.update(status="INCONCLUSIVE", reason="ANALYSIS_INVALID", findings=[]), lambda row: row.update(evidence_verified=False), lambda row: row["findings"][0].update(quote_sha256="0" * 64), lambda row: row["findings"][0].update(start_line=2, end_line=2)]:
        leader = copy.deepcopy(result)
        mutate(leader)
        assert not contract._agree(leader, result, value, texts)


def test_valid_different_supporting_spans_are_accepted(contract, module):
    result, texts, value = review(contract, module)
    leader = copy.deepcopy(result)
    leader["findings"][0]["start_line"] = 3
    quote = "".join(TEXT.splitlines(keepends=True)[2:4])
    leader["findings"][0]["quote_sha256"] = hashlib.sha256(quote.encode()).hexdigest()
    assert contract._agree(leader, result, value, texts)


def test_live_validator_rejects_changed_content(contract, module):
    value = mock_files(contract, module)
    contract.submit_scan(json.dumps(value), NONCE)
    module.gl.responses[contract._raw_url(value, "README.md")] = types.SimpleNamespace(body=b"tampered", status=200)
    assert not module.gl.validator(Return(module.gl.leader))
    assert not module.gl.validator(UserError("leader failed"))


@pytest.mark.parametrize("nonce", ["a" * 31, "a" * 65, "A" * 32, "g" * 32, "", None])
def test_invalid_nonce_costs_no_fetch(contract, module, nonce):
    with pytest.raises(UserError):
        contract.submit_scan(json.dumps(manifest()), nonce)
    assert module.gl.fetch_calls == [] and contract.scan_count == 0


def test_wallet_scoped_nonce_and_latest_results(contract, module):
    value = mock_files(contract, module)
    first = contract.submit_scan(json.dumps(value), NONCE)
    with pytest.raises(UserError, match="Nonce already"):
        contract.submit_scan(json.dumps(value), NONCE)
    module.gl.message.sender_address = Address(BOB)
    second = contract.submit_scan(json.dumps(value), NONCE)
    assert first["id"] == "1" and second["id"] == "2"
    assert contract.get_latest_scan(ALICE)["id"] == "1"
    assert contract.get_latest_scan(BOB)["id"] == "2"
    assert contract.get_scan("999") == {}
    assert contract.get_latest_scan("0x" + "3" * 40) == {}


def test_storage_cap_rejects_before_web(contract, module):
    contract.scan_count = module.MAX_SCANS
    with pytest.raises(UserError, match="storage limit"):
        contract.submit_scan(json.dumps(manifest()), NONCE)
    assert module.gl.fetch_calls == []


def test_same_failure_can_agree_but_not_with_a_reviewed_result(contract, module):
    good, texts, value = review(contract, module)
    failed = contract._empty_review(good["files"], "ANALYSIS_UNAVAILABLE")
    assert contract._agree(failed, copy.deepcopy(failed), value, texts)
    assert not contract._agree(failed, good, value, texts)


@pytest.mark.parametrize("category,subject,quote,expected", [
    ("LEGACY_CRYPTO", "SHA1", "SHA-1 is used", True),
    ("LEGACY_CRYPTO", "MD5", "sha256(data)", False),
    ("PQC_IMPLEMENTATION", "ML-KEM", "We use ML-KEM", True),
    ("PQC_MIGRATION", "MIGRATION_PLAN", "ML-KEM terminology", False),
    ("SECURITY_POLICY", "DISCLOSURE_POLICY", "Report security vulnerabilities", True),
    ("SECRET_EXPOSURE", "CREDENTIAL", 'api_key = "your_example_1234567890"', False),
    ("SECRET_EXPOSURE", "CREDENTIAL", 'api_key = "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"', False),
    ("SECRET_EXPOSURE", "CREDENTIAL", 'token = "a8B3cD7eF9gH2iJ6kL4mN0pQ"', True),
])
def test_citation_signal_guards(contract, category, subject, quote, expected):
    assert contract._has_signal(category, subject, quote) is expected


def test_credentials_are_not_copied_into_receipt(contract, module):
    secret = "a8B3cD7eF9gH2iJ6kL4mN0pQ"
    text = TEXT + f'token = "{secret}"\n'
    value = manifest(text=text)
    mock_files(contract, module, value, body=text.encode())
    module.gl.answer = {"uncertain": False, "findings": [{"category": "SECRET_EXPOSURE", "subject": "CREDENTIAL", "path": "README.md", "start_line": 5, "end_line": 5}]}
    scan = contract.submit_scan(json.dumps(value), NONCE)
    assert secret not in json.dumps(scan) and secret not in contract.scans["1"]
    assert scan["findings"][0]["quote_sha256"]
    assert scan["score"] == 45 and scan["risk_level"] == "MEDIUM"


def test_plan_does_not_receive_implementation_bonus(contract, module):
    result, _, _ = review(contract, module)
    assert contract._assessment(result)["score"] == 85
    result["findings"][0].update(category="PQC_IMPLEMENTATION", subject="ML-KEM")
    assert contract._assessment(result)["score"] == 90


def test_inconclusive_nonce_is_consumed_only_once(contract, module):
    value = mock_files(contract, module, status=404)
    scan = contract.submit_scan(json.dumps(value), NONCE)
    assert scan["status"] == "INCONCLUSIVE"
    with pytest.raises(UserError, match="Nonce already"):
        contract.submit_scan(json.dumps(value), NONCE)


def test_line_hash_preserves_crlf(contract, module):
    text = TEXT.replace("\n", "\r\n")
    value = manifest(text=text)
    mock_files(contract, module, value, body=text.encode())
    scan = contract.submit_scan(json.dumps(value), NONCE)
    assert scan["findings"][0]["quote_sha256"] == hashlib.sha256(text.splitlines(keepends=True)[3].encode()).hexdigest()

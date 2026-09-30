"""Run v2 through the real Python SDK/GenVM direct harness with mocked web/LLM."""

import copy
import hashlib
import json
from pathlib import Path

import pytest


CONTRACT = str(Path(__file__).parents[2] / "contracts/quantum_safe_scan_v2.py")
SHA = "a" * 40
NONCE = "b" * 32
TEXT = "# Repository evidence\nThis repository documents real public security controls but makes no safety certification.\nReport security vulnerabilities through private repository advisories.\nA concrete post-quantum migration plan inventories long-lived keys before an ML-KEM transition.\n"
MANIFEST = {"repository": "https://github.com/example/repo", "commit": SHA, "files": [{"path": "README.md", "sha256": hashlib.sha256(TEXT.encode()).hexdigest()}]}
ANSWER = {"uncertain": False, "findings": [{"category": "PQC_MIGRATION", "subject": "MIGRATION_PLAN", "path": "README.md", "start_line": 4, "end_line": 4}]}


def deploy(direct_vm, direct_deploy_compat, status=200, answer=None):
    direct_vm.mock_web(r".*raw\.githubusercontent\.com/example/repo/a{40}/README\.md.*", {"status": status, "body": TEXT})
    direct_vm.mock_llm(r".*Review only the selected, hash-verified repository files.*", json.dumps(json.dumps(ANSWER if answer is None else answer)))
    return direct_deploy_compat(CONTRACT)


def test_sdk_stores_pinned_review_and_matching_nonce(direct_vm, direct_deploy_compat):
    contract = deploy(direct_vm, direct_deploy_compat)
    receipt = contract.submit_scan(json.dumps(MANIFEST), NONCE)
    assert receipt["status"] == "REVIEWED"
    assert receipt["score"] == 85 and receipt["evidence_verified"] is True
    assert contract.get_scan_count() == 1 and contract.get_config()["version"] == 2
    assert contract.get_scan_for_nonce(receipt["submitted_by"], NONCE)["id"] == "1"
    assert contract.get_latest_scan(receipt["submitted_by"])["nonce"] == NONCE
    assert direct_vm.run_validator() is True


@pytest.mark.parametrize("field", ["digest", "finding", "line", "quote", "decision"])
def test_sdk_validator_rejects_tampering(direct_vm, direct_deploy_compat, field):
    contract = deploy(direct_vm, direct_deploy_compat)
    contract.submit_scan(json.dumps(MANIFEST), NONCE)
    leader = copy.deepcopy(direct_vm._captured_validators[-1][0])
    if field == "digest":
        leader["files"][0]["observed_sha256"] = "0" * 64
    elif field == "finding":
        leader["findings"] = []
    elif field == "line":
        leader["findings"][0].update(start_line=1, end_line=1)
    elif field == "quote":
        leader["findings"][0]["quote_sha256"] = "0" * 64
    else:
        leader.update(status="INCONCLUSIVE", reason="ANALYSIS_UNCERTAIN", findings=[])
    assert direct_vm.run_validator(leader_result=leader) is False


@pytest.mark.parametrize("status", [404, 503])
def test_sdk_records_unavailable_evidence_without_a_score(direct_vm, direct_deploy_compat, status):
    contract = deploy(direct_vm, direct_deploy_compat, status=status)
    receipt = contract.submit_scan(json.dumps(MANIFEST), NONCE)
    assert receipt["status"] == "INCONCLUSIVE" and receipt["score"] is None
    assert receipt["risk_level"] == "UNASSESSED"
    assert contract.get_scan_count() == 1
    assert direct_vm.run_validator() is True


@pytest.mark.parametrize("answer,reason", [({"uncertain": True, "findings": []}, "ANALYSIS_UNCERTAIN"), ({"uncertain": "false", "findings": []}, "ANALYSIS_INVALID"), ({"uncertain": False, "findings": [{**ANSWER["findings"][0], "end_line": 99}]}, "ANALYSIS_INVALID")])
def test_sdk_analysis_fails_closed(direct_vm, direct_deploy_compat, answer, reason):
    contract = deploy(direct_vm, direct_deploy_compat, answer=answer)
    receipt = contract.submit_scan(json.dumps(MANIFEST), NONCE)
    assert receipt["reason"] == reason and receipt["score"] is None
    assert direct_vm.run_validator() is True


def test_sdk_rejects_nonce_replay_and_a_leader_error(direct_vm, direct_deploy_compat):
    contract = deploy(direct_vm, direct_deploy_compat)
    contract.submit_scan(json.dumps(MANIFEST), NONCE)
    with direct_vm.expect_revert("Nonce already recorded"):
        contract.submit_scan(json.dumps(MANIFEST), NONCE)
    assert direct_vm.run_validator(leader_error=ValueError("leader failed")) is False


def test_sdk_validator_independently_fetches(direct_vm, direct_deploy_compat):
    contract = deploy(direct_vm, direct_deploy_compat)
    contract.submit_scan(json.dumps(MANIFEST), NONCE)
    direct_vm.clear_mocks()
    direct_vm.mock_web(r".*raw\.githubusercontent\.com/.*", {"status": 503, "body": "unavailable"})
    assert direct_vm.run_validator() is False

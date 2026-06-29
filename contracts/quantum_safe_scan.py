# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import json
from dataclasses import dataclass
from genlayer import *


@allow_storage
@dataclass
class ScanResult:
    id: str
    submitted_by: str
    target_url: str
    score: u256
    risk_level: str
    verdict: str
    evidence_summary: str
    recommended_fixes_json: str
    block_info: str


class QuantumSafeScan(gl.Contract):
    scans: TreeMap[str, ScanResult]
    latest_scan_by_user: TreeMap[Address, str]
    scan_count: u256

    def __init__(self):
        self.scans = TreeMap()
        self.latest_scan_by_user = TreeMap()
        self.scan_count = u256(0)

    def _normalize_github_url(self, target_url: str) -> str:
        url = target_url.strip()
        if url.startswith("https://www.github.com/"):
            url = "https://github.com/" + url[len("https://www.github.com/") :]

        if not url.startswith("https://github.com/"):
            raise gl.vm.UserError("Only public GitHub HTTPS repo URLs are supported")

        path = url[len("https://github.com/") :].split("?")[0].split("#")[0]
        parts = [part for part in path.split("/") if part]
        if len(parts) < 2:
            raise gl.vm.UserError("GitHub URL must include owner and repository")

        return "https://github.com/" + parts[0] + "/" + parts[1]

    def _as_bool(self, value) -> bool:
        return value is True or str(value).lower() == "true"

    def _as_string_list(self, value) -> list:
        if isinstance(value, list):
            return [str(item) for item in value[0:8]]
        if value:
            return [str(value)]
        return []

    def _normalize_analysis(self, raw: dict) -> dict:
        evidence_quality = str(raw.get("evidence_quality", "WEAK")).upper()
        if evidence_quality != "ENOUGH":
            evidence_quality = "WEAK"

        return {
            "readme_present": self._as_bool(raw.get("readme_present", False)),
            "security_policy_present": self._as_bool(
                raw.get("security_policy_present", False)
            ),
            "risky_old_crypto_terms": self._as_string_list(
                raw.get("risky_old_crypto_terms", [])
            ),
            "post_quantum_terms": self._as_string_list(
                raw.get("post_quantum_terms", [])
            ),
            "secret_like_terms": self._as_string_list(
                raw.get("secret_like_terms", [])
            ),
            "evidence_quality": evidence_quality,
            "evidence_summary": str(raw.get("evidence_summary", ""))[0:500],
            "verdict": str(raw.get("verdict", ""))[0:500],
        }

    def _analyze_public_evidence(self, target_url: str) -> dict:
        def collect_evidence() -> str:
            repo_page = gl.nondet.web.render(target_url, mode="text")
            security_page = gl.nondet.web.render(
                target_url + "/security/policy", mode="text"
            )

            task = f"""
Analyze the public GitHub repository evidence for a lightweight security and
quantum-readiness scan.

Target URL:
{target_url}

Repository page text:
{repo_page[0:12000]}

Security policy page text:
{security_page[0:6000]}

Return only JSON with exactly these keys:
{{
  "readme_present": boolean,
  "security_policy_present": boolean,
  "risky_old_crypto_terms": string[],
  "post_quantum_terms": string[],
  "secret_like_terms": string[],
  "evidence_quality": "ENOUGH" | "WEAK",
  "evidence_summary": string,
  "verdict": string
}}

Detection rules:
- readme_present is true if a README or meaningful repository overview is visible.
- security_policy_present is true only if SECURITY.md, a security policy, or
  responsible disclosure policy appears to be present.
- risky_old_crypto_terms may include MD5, SHA1, SHA-1, RSA-1024, DES, or 3DES.
- post_quantum_terms may include Kyber, Dilithium, ML-KEM, ML-DSA,
  post-quantum, or PQC.
- secret_like_terms should include only apparent exposed secret indicators such
  as api_key, private_key, secret, or token when they appear risky in context.
- evidence_quality is WEAK if the public evidence is missing, blocked, empty,
  or too thin for a useful verdict.
"""
            result = gl.nondet.exec_prompt(task, response_format="json")
            return json.dumps(result, sort_keys=True)

        analysis_json = gl.eq_principle.strict_eq(collect_evidence)
        return self._normalize_analysis(json.loads(analysis_json))

    def _score(self, analysis: dict) -> int:
        score = 70
        if analysis["readme_present"]:
            score += 10
        if analysis["security_policy_present"]:
            score += 10
        if len(analysis["post_quantum_terms"]) > 0:
            score += 10
        if len(analysis["risky_old_crypto_terms"]) > 0:
            score -= 15
        if len(analysis["secret_like_terms"]) > 0:
            score -= 15
        if analysis["evidence_quality"] == "WEAK":
            score -= 10

        if score < 0:
            return 0
        if score > 100:
            return 100
        return score

    def _risk_level(self, score: int) -> str:
        if score >= 75:
            return "LOW"
        if score >= 45:
            return "MEDIUM"
        return "HIGH"

    def _recommended_fixes(self, analysis: dict) -> list:
        fixes = []
        if not analysis["security_policy_present"]:
            fixes.append("Add SECURITY.md and a responsible disclosure policy")
        if len(analysis["risky_old_crypto_terms"]) > 0:
            fixes.append("Replace weak crypto references like MD5/SHA1/RSA-1024")
        if len(analysis["secret_like_terms"]) > 0:
            fixes.append("Remove exposed secret-like values from public files")
        if len(analysis["post_quantum_terms"]) == 0:
            fixes.append("Add a post-quantum migration note for long-term assets")
        if analysis["evidence_quality"] == "WEAK":
            fixes.append("Publish clearer README evidence for security reviewers")

        if len(fixes) < 3:
            fixes.append("Document dependency update and vulnerability triage steps")
        if len(fixes) < 3:
            fixes.append("Add automated secret scanning and crypto linting")

        return fixes[0:3]

    def _scan_to_dict(self, scan: ScanResult) -> dict:
        return {
            "id": scan.id,
            "submitted_by": scan.submitted_by,
            "target_url": scan.target_url,
            "score": int(scan.score),
            "risk_level": scan.risk_level,
            "verdict": scan.verdict,
            "evidence_summary": scan.evidence_summary,
            "recommended_fixes": json.loads(scan.recommended_fixes_json),
            "block_info": scan.block_info,
        }

    @gl.public.write
    def submit_scan(self, target_url: str) -> dict:
        normalized_url = self._normalize_github_url(target_url)
        analysis = self._analyze_public_evidence(normalized_url)
        score = self._score(analysis)
        risk_level = self._risk_level(score)
        fixes = self._recommended_fixes(analysis)

        scan_id = str(int(self.scan_count) + 1)
        sender = gl.message.sender_address
        result = ScanResult(
            id=scan_id,
            submitted_by=sender.as_hex,
            target_url=normalized_url,
            score=u256(score),
            risk_level=risk_level,
            verdict=analysis["verdict"],
            evidence_summary=analysis["evidence_summary"],
            recommended_fixes_json=json.dumps(fixes),
            block_info="scan_index:" + scan_id,
        )

        self.scans[scan_id] = result
        self.latest_scan_by_user[sender] = scan_id
        self.scan_count = u256(int(self.scan_count) + 1)

        return self._scan_to_dict(result)

    @gl.public.view
    def get_latest_scan(self, user_address: str) -> dict:
        user = Address(user_address)
        latest_id = self.latest_scan_by_user.get(user)
        if not latest_id:
            return {}
        return self._scan_to_dict(self.scans[latest_id])

    @gl.public.view
    def get_scan(self, scan_id: str) -> dict:
        if scan_id not in self.scans:
            return {}
        return self._scan_to_dict(self.scans[scan_id])

    @gl.public.view
    def get_scan_count(self) -> int:
        return int(self.scan_count)


# Métriques du pipeline DevSecOps (§6.3)

## 1. Temps de build (Impact de la sécurité)

| Étape | Temps moyen mesuré |
|---|---|
| `build-and-push` seul (sans sécurité) | ~27 secondes |
| Pipeline complet (8 jobs en parallèle) | ~1 minute 15 secondes |
| **Overhead de sécurité** | **~48 secondes** (Acceptable pour un pipeline industriel) |

## 2. Taux de détection (Preuve par l'échec)

| Gate | Outil | Vulnérabilité injectée | Détecté ? |
|---|---|---|---|
| SAST | Semgrep | SQL Injection (`app/test-sqli.js`) | ✅ Oui (1 finding) |
| SCA | Trivy (fs) | lodash 4.17.11 + minimist 1.2.0 | ✅ Oui (5 CVE) |
| Secrets | Gitleaks | Fausse clé AWS | ✅ Oui (2 findings) |
| Image Scan | Trivy (image) | CVE critiques dans l'image de base | ✅ Oui (via `.trivyignore` justifié) |
| Admission | Kyverno | Image non signée (ex: `nginx:1.27`) | ✅ Oui (bloqué) |
| Admission | Kyverno | Tag `latest` | ✅ Oui (bloqué) |
| Réseau | Calico | Egress non autorisé | ✅ Oui (timeout) |

**Taux de détection global : 7/7 (100%)**

## 3. Faux positifs observés

| Outil | Faux positifs sur code propre (`main`) |
|---|---|
| Semgrep (règles par défaut) | 0 |
| Semgrep (règle custom SQLi) | 0 |
| Trivy (fs & image) | 0 (après configuration du `.trivyignore`) |
| Gitleaks | 0 (après configuration du `.gitleaks.toml`) |

## 4. Taille et complétude du SBOM

- **Format :** CycloneDX JSON
- **Outil :** Syft (v1.54.1)
- **Nombre de composants recensés :** **2744 composants**
- **Validation :** Le SBOM est signé et attaché à l'image via `cosign attest`.

## 5. Temps de détection (Commit → Blocage)

| Gate | Temps moyen (du push au feedback) |
|---|---|
| SAST / SCA / Secrets | ~1 minute (GitHub Actions runner) |
| Signature / Attestation | +30 secondes |
| Admission (Runtime) | < 1 seconde (rejet immédiat par Kyverno) |

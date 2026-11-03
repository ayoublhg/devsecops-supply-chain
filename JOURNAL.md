
# Journal de bord — Projet DevSecOps Supply Chain Security

**Auteur :** Ayoub Lahouegue /Eyet Allah Ben Othman
**Durée :** 8 semaines
**Type :** Projet solo

Ce journal documente les décisions techniques, les blocages et les solutions rencontrées durant le projet.

---

## Semaine 1-2 — Fondations & Pipeline initial

### Objectif
Disposer d'un pipeline CI/CD qui build et push l'application cible, et d'un cluster local fonctionnel.

### Choix techniques
- **CI/CD :** GitHub Actions (gratuit, intégration native GHCR, support OIDC).
- **App cible :** OWASP Juice Shop (vulnérable par design, gain de temps).
- **Cluster :** Kind (léger, s'exécute dans Docker Desktop).
- **Environnement :** WSL2 Ubuntu + VS Code (Remote-WSL).

### Tâches réalisées
- Création du `Dockerfile` basé sur `bkimminich/juice-shop:latest`.
- Pipeline initial `build-and-push` vers GHCR.
- Création du cluster Kind avec secret `ghcr-secret` pour pull l'image privée.

### Blocages & Solutions
- *Blocage :* `pip install` échoue avec `externally-managed-environment` (PEP 668). *Solution :* Utilisation de `pipx` pour isoler Semgrep.
- *Blocage :* Le pipeline échoue avec `failed to read dockerfile`. *Solution :* Le fichier avait une faute de frappe (`Dcokerfile`). Renommé avec `git mv`.
- *Blocage :* Kind ne peut pas pull l'image GHCR. *Solution :* Création du secret Kubernetes `ghcr-secret` avec un Personal Access Token.

---

## Semaine 3-4 — Shift-Left Security (SAST, SCA, Secrets)

### Objectif
Bloquer le pipeline en cas de vulnérabilités de code, de dépendances ou de secrets.

### Choix techniques
- **SAST :** Semgrep (rapide, support natif des règles custom).
- **SCA :** Trivy (scan fs, génère du SARIF).
- **Secrets :** Gitleaks.

### Preuve par l'échec (§6.1)
1. **SAST :** Injection d'une requête SQL vulnérable. Les packs OSS ne l'ont pas détectée. *Solution :* Écriture d'une règle custom en mode `taint` (`custom-sqli.yaml`). Le gate a échoué avec `1 blocking finding`.
2. **SCA :** Injection de `lodash@4.17.11` et `minimist@1.2.0`. *Blocage :* Trivy fs ignorait le `package.json` car il manquait le `package-lock.json`. *Solution :* Génération du lockfile. Le gate a échoué avec 5 CVE.
3. **Secrets :** Injection d'une fausse clé AWS. *Blocage :* GitHub Push Protection bloque le push des clés Stripe. De plus, la clé d'exemple AWS (`AKIAIOSFODNN7EXAMPLE`) est dans l'allowlist de Gitleaks. *Solution :* Utilisation d'une clé AWS non-allowlistée. Le gate a échoué avec 2 findings.

---

## Semaine 5-6 — Supply Chain Security (SBOM & Signature)

### Objectif
Générer un SBOM, scanner l'image, signer l'image et vérifier la signature.

### Choix techniques
- **SBOM :** Syft (format CycloneDX).
- **Signature :** Cosign en mode "Keyless" via OIDC GitHub.
- **Attestation :** Cosign attest.

### Tâches réalisées
- Ajout de `anchore/sbom-action` dans le build. Le SBOM contient **2744 composants**.
- Ajout du job `image-scan` (Gate 3). *Blocage :* L'image Juice Shop contient des CVE critiques dans sa couche de base Debian. *Solution :* Création d'un `.trivyignore` documenté pour ignorer les CVE non patchables upstream, tout en gardant le gate actif pour le futur.
- Signature de l'image par digest avec `cosign sign`. Vérification avec `cosign verify-attestation` (l'identité émettrice a été validée comme étant `pipeline.yml@refs/heads/main`).

---

## Semaine 7 — Runtime Security (Kyverno & Calico)

### Objectif
Empêcher le déploiement d'images non signées sur le cluster.

### Choix techniques
- **CNI :** Calico. *Raison :* Le CNI par défaut de Kind (`kindnet`) ignore silencieusement les NetworkPolicies.
- **Admission Controller :** Kyverno (v1.19.1).

### Preuve par l'échec (§6.1)
- **Test Tag `latest` :** `kubectl run test-latest --image=busybox:latest` → Rejeté par la policy `disallow-latest-tag`.
- **Test Image non signée :** Push d'une image BusyBox sous le chemin du projet sans signature. `kubectl run test-unsigned...` → Rejeté par `verify-image-signatures` (Kyverno n'a trouvé aucune signature valide).
- **Test Réseau :** Application de `default-deny-all`. Test avec `wget http://1.1.1.1` → Timeout (Calico bloque l'egress).

### Notes techniques
Kyverno 1.19 déprécie `kyverno.io/v1` (ClusterPolicy) au profit de l'API CEL `policies.kyverno.io/v1` (ValidatingPolicy, ImageValidatingPolicy). Les policies actuelles fonctionnent en mode legacy. La migration vers l'API CEL est documentée comme piste d'amélioration.

---

## Semaine 8 — Finalisation & Documentation

- Rédaction du README, du journal et du rapport technique.
- Génération des métriques et du comparatif d'outils.
- Préparation du scénario de démonstration (preuves d'échec contrôlé).

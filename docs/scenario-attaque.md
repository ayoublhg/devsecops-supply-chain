
# Scénario de démonstration — Preuve par l'échec contrôlé

Ce document décrit les 4 attaques simulées pour prouver l'efficacité du pipeline.

## Attaque 1 : Vulnérabilité dans le code (SAST)
- **Action :** Ajout d'un fichier `app/test-sqli.js` avec une requête SQL vulnérable (`"SELECT * FROM users WHERE id = " + req.query.id`).
- **Gate :** `sast-scan` (Semgrep avec règle custom).
- **Preuve attendue :** Échec du job avec `Findings: 1 (1 blocking)`.
- **Screenshot :** `demo/screenshots/sast-blocked.png`

## Attaque 2 : Dépendance vulnérable (SCA)
- **Action :** Ajout d'un `package.json` et `package-lock.json` contenant `lodash@4.17.11` et `minimist@1.2.0`.
- **Gate :** `sca-scan` (Trivy).
- **Preuve attendue :** Échec du job avec détection de 5 CVE (dont CVE-2019-10744 et CVE-2021-44906).
- **Screenshot :** `demo/screenshots/sca-blocked.png`

## Attaque 3 : Secret en clair (Secrets)
- **Action :** Commit d'une fausse clé AWS (`AKIAJ7K2L9M3N5P8Q1R4`).
- **Gate :** `secret-scan` (Gitleaks).
- **Preuve attendue :** Échec du job avec `generic-api-key` et `aws-access-token` détectés.
- **Screenshot :** `demo/screenshots/secret-blocked.png`

## Attaque 4 : Contournement du pipeline (Runtime)
- **Action :** Tentative de déploiement manuel d'une image non signée (`kubectl run test-unsigned-sig --image=ghcr.io/ayoublhg/devsecops-supply-chain/juice-shop:unsigned-test`).
- **Gate :** Kyverno (Admission Controller).
- **Preuve attendue :** Rejet immédiat `failed to verify image... no signatures found`.
- **Screenshot :** `demo/screenshots/kyverno-rejected-unsigned.png`

## Bonus : Politique réseau (Runtime)
- **Action :** Application d'un `default-deny` NetworkPolicy et tentative d'appel sortant depuis un pod BusyBox.
- **Preuve attendue :** Timeout de la requête `wget`.
- **Screenshot :** `demo/screenshots/networkpolicy-blocked.png`

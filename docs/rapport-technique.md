# Rapport Technique : Pipeline DevSecOps et Sécurité de la Chaîne d'Approvisionnement Logicielle

**Auteur :** Ayoub Lahouegue / Eyet Allah Ben Othman
**Niveau :** 5ème année — Master/Ingénieur Cybersécurité
**Projet :** Pipeline DevSecOps Complet avec Software Supply Chain Security

---

## 1. Introduction et Contexte

La sécurisation de la chaîne d'approvisionnement logicielle (Software Supply Chain Security) est devenue un enjeu critique. Les récentes attaques (SolarWinds, Log4Shell, xz-utils/CVE-2024-3094) ont démontré que compromettre une dépendance ou un outil de build permet de toucher des milliers d'organisations simultanément. 

Ce projet vise à concevoir, implémenter et démontrer un pipeline CI/CD intégrant les meilleures pratiques de sécurité "Shift-Left" et "Fail-Closed" pour garantir l'intégrité et la provenance des artefacts logiciels.

## 2. Objectifs du Projet

Le pipeline développé répond aux objectifs suivants :
1. **Détection automatique** des vulnérabilités (code, dépendances, secrets) avant le déploiement.
2. **Génération de SBOM** (Software Bill of Materials) pour la transparence.
3. **Signature cryptographique** des artefacts (Cosign) et vérification de provenance (Attestation).
4. **Contrôle d'admission** au niveau du cluster Kubernetes (rejet des images non signées).
5. **Preuve par l'échec** : démontrer que chaque sécurité bloque effectivement une attaque simulée.

## 3. Architecture Technique

Le pipeline repose sur un couplage entre GitHub Actions (CI/CD) et un cluster Kubernetes local (Kind) pour l'exécution.

### 3.1 Vue d'ensemble
*(Insérer ici le schéma de l'architecture, voir le README.md)*

### 3.2 Choix de la Stack
- **CI/CD :** GitHub Actions (gratuit, intégration OIDC native pour Sigstore).
- **Application cible :** OWASP Juice Shop (image vulnérable par design).
- **Orchestration :** Kind (Kubernetes in Docker) + Calico pour l'application réelle des NetworkPolicies.
- **Admission Controller :** Kyverno (v1.19) pour sa syntaxe YAML native et son support natif de Cosign.

## 4. Justification des Choix d'Outils

*(Se référer aux tableaux détaillés dans `docs/comparatif-outils.md`)*

- **SAST :** Semgrep a été préféré à SonarQube pour sa légèreté en CI/CD et sa capacité à exécuter des règles custom (mode *taint*) sans serveur dédié.
- **SCA & Image Scan :** Trivy a été retenu face à OWASP Dependency-Check pour sa rapidité et sa capacité à scanner à la fois le code (filesystem) et l'image conteneurisée.
- **SBOM :** Syft a été choisi pour sa capacité à extraire le SBOM directement de l'image Docker (CycloneDX).
- **Signature :** Cosign en mode *Keyless* (Sigstore) élimine le problème de gestion des clés privées en s'appuyant sur l'identité OIDC de GitHub Actions.
- **Admission :** Kyverno a été préféré à OPA Gatekeeper car il permet de vérifier les signatures Cosign en quelques lignes de YAML, sans apprendre le langage Rego.

## 5. Description Détaillée du Pipeline

Le pipeline `pipeline.yml` se compose de 8 jobs :
1. **`build-and-push` :** Build de l'image et génération du SBOM avec Syft (2744 composants détectés).
2. **`sast-scan` :** Analyse du code source avec Semgrep (règle custom SQLi + packs OWASP).
3. **`sca-scan` :** Analyse des dépendances (fs) avec Trivy (bloque si CVE CRITICAL/HIGH).
4. **`secret-scan` :** Recherche de secrets avec Gitleaks.
5. **`image-scan` :** Scan de l'image conteneur avec Trivy (Gate 3).
6. **`sign-image` :** Signature de l'image par *digest* avec Cosign (Keyless).
7. **`attest-sbom` :** Attachement cryptographique du SBOM à l'image (CycloneDX).
8. **`verify-signature` :** Vérification de la signature (Gate CD). Si l'image n'est pas signée par notre workflow, le job échoue.

## 6. Scénarios de Test et Preuve par l'Échec

Conformément aux exigences, chaque sécurité a été testée avec une injection volontaire.

### 6.1 Vulnérabilité de code (SAST)
- **Test :** Injection d'un fichier `test-sqli.js` contenant une concaténation SQL vulnérable.
- **Résultat :** Le job `sast-scan` échoue avec 1 finding (règle custom `custom-sqli.yaml`).
- **Preuve :** *(Insérer Screenshot `demo/screenshots/sast-blocked.png`)*

### 6.2 Dépendance vulnérable (SCA)
- **Test :** Ajout de `lodash@4.17.11` et `minimist@1.2.0` avec lockfile.
- **Résultat :** Le job `sca-scan` échoue avec 5 CVE détectées.
- **Preuve :** *(Insérer Screenshot `demo/screenshots/sca-blocked.png`)*

### 6.3 Secret en clair
- **Test :** Commit d'une fausse clé AWS.
- **Résultat :** Le job `secret-scan` échoue (2 findings).
- **Preuve :** *(Insérer Screenshot `demo/screenshots/secret-blocked.png`)*

### 6.4 Contournement du pipeline (Runtime)
- **Test :** Tentative de déploiement manuel (`kubectl run`) d'une image non signée portant le nom de notre registre.
- **Résultat :** Kyverno rejette le pod immédiatement (`no signatures found`).
- **Preuve :** *(Insérer Screenshot `demo/screenshots/kyverno-rejected-unsigned.png`)*

## 7. Résultats et Métriques

*(Se référer au fichier `docs/metriques.md`)*

- **Taux de détection :** 7/7 = 100%.
- **Temps de build complet :** ~1m15s (contre 27s sans sécurité).
- **Taille du SBOM :** 2744 composants.
- **Validation cryptographique :** Le `cosign verify-attestation` confirme que l'image a été signée par `https://github.com/ayoublhg/devsecops-supply-chain/.github/workflows/pipeline.yml@refs/heads/main`.

## 8. Analyse Critique et Limites

1. **Dépendance aux lockfiles :** Trivy fs nécessite un `package-lock.json`. Un simple `package.json` est ignoré (faux négatif identifié et documenté durant le projet).
2. **CVE de l'image de base :** L'image Juice Shop contient des CVE critiques non patchables. Nous avons dû utiliser un `.trivyignore` justifié pour maintenir le gate actif sans bloquer le projet.
3. **GitHub Push Protection :** A bloqué nos tests de secrets (clé Stripe), prouvant l'importance des défenses en profondeur (Server-side + CI).
4. **Dépréciation Kyverno :** L'API `ClusterPolicy` est dépréciée au profit des `ImageValidatingPolicy` (CEL). Une migration est à prévoir.
5. **Limites de l'environnement :** L'utilisation d'un cluster local (Kind) avec Calico consomme beaucoup de RAM (limité sur un laptop).

## 9. Comparaison avec les Solutions Commerciales

| Fonctionnalité | Notre Pipeline (Open Source) | Snyk / JFrog Xray | Chainguard |
|---|---|---|---|
| **SAST/SCA** | Semgrep + Trivy | Base de données de vulnérabilités propriétaire, plus précise | N/A |
| **Signature** | Cosign (Keyless) | Intégré | N/A |
| **Images de base** | OWASP Juice Shop (Debian standard) | N/A | Images "Zero-CVE" (distroless) |
| **Coût** | 100% Gratuit | Très cher (licence par développeur) | Payant par image |

*Conclusion :* Les solutions commerciales offrent une meilleure base de données (moins de faux positifs) et Chainguard résout le problème des CVE de l'image de base. Cependant, notre pipeline prouve qu'une architecture robuste (SLSA, Sigstore) est réalisable uniquement avec des outils OSS.

## 10. Conclusion

Le pipeline développé démontre qu'il est possible de sécuriser une chaîne d'approvisionnement logicielle de bout en bout avec des outils open source. En bloquant les vulnérabilités dès le commit (Shift-Left) et en garantissant la provenance des artefacts lors du déploiement (Runtime Admission), nous avons mis en place un système "Fail-Closed" où aucune image non conforme ne peut atteindre le cluster.
EOF~
[200~# Rapport Technique : Pipeline DevSecOps et Sécurité de la Chaîne d'Approvisionnement Logicielle

**Auteur :** Ayoub Lahouegue
**Niveau :** 5ème année — Master/Ingénieur Cybersécurité
**Projet :** Pipeline DevSecOps Complet avec Software Supply Chain Security

---

## 1. Introduction et Contexte

La sécurisation de la chaîne d'approvisionnement logicielle (Software Supply Chain Security) est devenue un enjeu critique. Les récentes attaques (SolarWinds, Log4Shell, xz-utils/CVE-2024-3094) ont démontré que compromettre une dépendance ou un outil de build permet de toucher des milliers d'organisations simultanément. 

Ce projet vise à concevoir, implémenter et démontrer un pipeline CI/CD intégrant les meilleures pratiques de sécurité "Shift-Left" et "Fail-Closed" pour garantir l'intégrité et la provenance des artefacts logiciels.

## 2. Objectifs du Projet

Le pipeline développé répond aux objectifs suivants :
1. **Détection automatique** des vulnérabilités (code, dépendances, secrets) avant le déploiement.
2. **Génération de SBOM** (Software Bill of Materials) pour la transparence.
3. **Signature cryptographique** des artefacts (Cosign) et vérification de provenance (Attestation).
4. **Contrôle d'admission** au niveau du cluster Kubernetes (rejet des images non signées).
5. **Preuve par l'échec** : démontrer que chaque sécurité bloque effectivement une attaque simulée.

## 3. Architecture Technique

Le pipeline repose sur un couplage entre GitHub Actions (CI/CD) et un cluster Kubernetes local (Kind) pour l'exécution.

### 3.1 Vue d'ensemble
*(Insérer ici le schéma de l'architecture, voir le README.md)*

### 3.2 Choix de la Stack
- **CI/CD :** GitHub Actions (gratuit, intégration OIDC native pour Sigstore).
- **Application cible :** OWASP Juice Shop (image vulnérable par design).
- **Orchestration :** Kind (Kubernetes in Docker) + Calico pour l'application réelle des NetworkPolicies.
- **Admission Controller :** Kyverno (v1.19) pour sa syntaxe YAML native et son support natif de Cosign.

## 4. Justification des Choix d'Outils

*(Se référer aux tableaux détaillés dans `docs/comparatif-outils.md`)*

- **SAST :** Semgrep a été préféré à SonarQube pour sa légèreté en CI/CD et sa capacité à exécuter des règles custom (mode *taint*) sans serveur dédié.
- **SCA & Image Scan :** Trivy a été retenu face à OWASP Dependency-Check pour sa rapidité et sa capacité à scanner à la fois le code (filesystem) et l'image conteneurisée.
- **SBOM :** Syft a été choisi pour sa capacité à extraire le SBOM directement de l'image Docker (CycloneDX).
- **Signature :** Cosign en mode *Keyless* (Sigstore) élimine le problème de gestion des clés privées en s'appuyant sur l'identité OIDC de GitHub Actions.
- **Admission :** Kyverno a été préféré à OPA Gatekeeper car il permet de vérifier les signatures Cosign en quelques lignes de YAML, sans apprendre le langage Rego.

## 5. Description Détaillée du Pipeline

Le pipeline `pipeline.yml` se compose de 8 jobs :
1. **`build-and-push` :** Build de l'image et génération du SBOM avec Syft (2744 composants détectés).
2. **`sast-scan` :** Analyse du code source avec Semgrep (règle custom SQLi + packs OWASP).
3. **`sca-scan` :** Analyse des dépendances (fs) avec Trivy (bloque si CVE CRITICAL/HIGH).
4. **`secret-scan` :** Recherche de secrets avec Gitleaks.
5. **`image-scan` :** Scan de l'image conteneur avec Trivy (Gate 3).
6. **`sign-image` :** Signature de l'image par *digest* avec Cosign (Keyless).
7. **`attest-sbom` :** Attachement cryptographique du SBOM à l'image (CycloneDX).
8. **`verify-signature` :** Vérification de la signature (Gate CD). Si l'image n'est pas signée par notre workflow, le job échoue.

## 6. Scénarios de Test et Preuve par l'Échec

Conformément aux exigences, chaque sécurité a été testée avec une injection volontaire.

### 6.1 Vulnérabilité de code (SAST)
- **Test :** Injection d'un fichier `test-sqli.js` contenant une concaténation SQL vulnérable.
- **Résultat :** Le job `sast-scan` échoue avec 1 finding (règle custom `custom-sqli.yaml`).
- **Preuve :** *(Insérer Screenshot `demo/screenshots/sast-blocked.png`)*

### 6.2 Dépendance vulnérable (SCA)
- **Test :** Ajout de `lodash@4.17.11` et `minimist@1.2.0` avec lockfile.
- **Résultat :** Le job `sca-scan` échoue avec 5 CVE détectées.
- **Preuve :** *(Insérer Screenshot `demo/screenshots/sca-blocked.png`)*

### 6.3 Secret en clair
- **Test :** Commit d'une fausse clé AWS.
- **Résultat :** Le job `secret-scan` échoue (2 findings).
- **Preuve :** *(Insérer Screenshot `demo/screenshots/secret-blocked.png`)*

### 6.4 Contournement du pipeline (Runtime)
- **Test :** Tentative de déploiement manuel (`kubectl run`) d'une image non signée portant le nom de notre registre.
- **Résultat :** Kyverno rejette le pod immédiatement (`no signatures found`).
- **Preuve :** *(Insérer Screenshot `demo/screenshots/kyverno-rejected-unsigned.png`)*

## 7. Résultats et Métriques

*(Se référer au fichier `docs/metriques.md`)*

- **Taux de détection :** 7/7 = 100%.
- **Temps de build complet :** ~1m15s (contre 27s sans sécurité).
- **Taille du SBOM :** 2744 composants.
- **Validation cryptographique :** Le `cosign verify-attestation` confirme que l'image a été signée par `https://github.com/ayoublhg/devsecops-supply-chain/.github/workflows/pipeline.yml@refs/heads/main`.

## 8. Analyse Critique et Limites

1. **Dépendance aux lockfiles :** Trivy fs nécessite un `package-lock.json`. Un simple `package.json` est ignoré (faux négatif identifié et documenté durant le projet).
2. **CVE de l'image de base :** L'image Juice Shop contient des CVE critiques non patchables. Nous avons dû utiliser un `.trivyignore` justifié pour maintenir le gate actif sans bloquer le projet.
3. **GitHub Push Protection :** A bloqué nos tests de secrets (clé Stripe), prouvant l'importance des défenses en profondeur (Server-side + CI).
4. **Dépréciation Kyverno :** L'API `ClusterPolicy` est dépréciée au profit des `ImageValidatingPolicy` (CEL). Une migration est à prévoir.
5. **Limites de l'environnement :** L'utilisation d'un cluster local (Kind) avec Calico consomme beaucoup de RAM (limité sur un laptop).

## 9. Comparaison avec les Solutions Commerciales

| Fonctionnalité | Notre Pipeline (Open Source) | Snyk / JFrog Xray | Chainguard |
|---|---|---|---|
| **SAST/SCA** | Semgrep + Trivy | Base de données de vulnérabilités propriétaire, plus précise | N/A |
| **Signature** | Cosign (Keyless) | Intégré | N/A |
| **Images de base** | OWASP Juice Shop (Debian standard) | N/A | Images "Zero-CVE" (distroless) |
| **Coût** | 100% Gratuit | Très cher (licence par développeur) | Payant par image |

*Conclusion :* Les solutions commerciales offrent une meilleure base de données (moins de faux positifs) et Chainguard résout le problème des CVE de l'image de base. Cependant, notre pipeline prouve qu'une architecture robuste (SLSA, Sigstore) est réalisable uniquement avec des outils OSS.

## 10. Conclusion

Le pipeline développé démontre qu'il est possible de sécuriser une chaîne d'approvisionnement logicielle de bout en bout avec des outils open source. En bloquant les vulnérabilités dès le commit (Shift-Left) et en garantissant la provenance des artefacts lors du déploiement (Runtime Admission), nous avons mis en place un système "Fail-Closed" où aucune image non conforme ne peut atteindre le cluster.

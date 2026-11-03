
# Comparatif des outils testés (§6.2)

Pour chaque catégorie, au moins deux outils ont été évalués. Le "Verdict" justifie l'outil retenu pour le pipeline.

## 1. SAST (Static Application Security Testing)

| Critère | Semgrep | SonarQube |
|---|---|---|
| **Intégration CI/CD** | Très facile (`pip install semgrep` ou Docker) | Complexe (nécessite un serveur SonarQube + base de données) |
| **Précision** | Excellente sur les règles custom (taint tracking) | Très bonne, plus orienté "qualité de code" global |
| **Performance** | ~30 secondes sur le projet | Plusieurs minutes (démarrage serveur + scan) |
| **Maturité/Communauté** | Très active, règles OSS et Pro | Standard de l'industrie, très mature |
| **Verdict** | **RETENU** : Idéal pour un pipeline léger, permet d'écrire des règles custom (comme `custom-sqli.yaml`) sans overhead. | **Écarté** : Trop lourd (CPU/RAM) pour un environnement local et un pipeline GitHub Actions gratuit. |

## 2. SCA (Software Composition Analysis)

| Critère | Trivy | OWASP Dependency-Check |
|---|---|---|
| **Intégration CI/CD** | Action GitHub officielle, installation instantanée | Nécessite un conteneur Java, configuration XML |
| **Précision** | Excellente, supporte OS + langages | Bonne, focalisée sur les dépendances applicatives |
| **Performance** | ~10 secondes (fs) / ~30 secondes (image) | Plusieurs minutes (téléchargement de la base NVD très lent) |
| **Maturité/Communauté** | Maintenu par Aqua Security, très récent | Projet OWASP historique |
| **Verdict** | **RETENU** : Scanne à la fois le système de fichiers et les images de conteneurs. Rapide et natif. | **Écarté** : Trop lent, ne scanne pas les images de conteneurs de manière native. |

## 3. SBOM (Software Bill of Materials)

| Critère | Syft | CycloneDX-tool |
|---|---|---|
| **Intégration CI/CD** | Action GitHub `anchore/sbom-action` | CLI Python (`cyclonedx-py`) |
| **Formats supportés** | CycloneDX, SPDX, Syft JSON | CycloneDX uniquement |
| **Performance** | Très rapide (scan direct de l'image Docker) | Dépend de l'input (souvent un fichier de dépendances, pas l'image) |
| **Maturité/Communauté** | Standard de facto pour les conteneurs | Référence officielle du format CycloneDX |
| **Verdict** | **RETENU** : Le seul à pouvoir générer un SBOM directement à partir de l'image conteneur (2744 composants détectés). | **Écarté** : Nécessite de fournir un fichier de dépendances (ex: `requirements.txt`), ne voit pas la couche OS. |

## 4. Signature d'artefacts

| Critère | Cosign (Sigstore) | Notary v2 (Notation) |
|---|---|---|
| **Intégration CI/CD** | Action GitHub officielle, mode "Keyless" via OIDC | Nécessite un plugin de signature et un registry supportant l'API Referrers |
| **Modèle de confiance** | Keyless (Fulcio + Rekor) : zéro clé privée à gérer | Certificats X.509 ou clés gérées manuellement |
| **Intégration Admission** | Native avec Kyverno et OPA | Nécessite `notation-gatekeeper` |
| **Performance** | Quelques secondes | Comparable |
| **Verdict** | **RETENU** : Le mode "Keyless" via GitHub OIDC est une révolution pour la CI/CD. L'intégration avec Kyverno est native. | **Écarté** : Écosystème moins mature, configuration plus lourde, nécessite la gestion de plugins. |

## 5. Admission Control (Kubernetes)

| Critère | Kyverno | OPA Gatekeeper |
|---|---|---|
| **Langage de policy** | YAML natif Kubernetes | Rego (DSL dédié, courbe d'apprentissage) |
| **Vérification Cosign** | Support natif (`verifyImages` dans la policy) | Nécessite l'injection de bibliothèques externes |
| **Performance** | Webhook K8s très léger | Webhook + boucle d'audit asynchrone |
| **Maturité/Communauté** | CNCF, très actif | CNCF, standard pour les politiques complexes |
| **Verdict** | **RETENU** : Permet de vérifier les signatures Cosign en quelques lignes de YAML sans apprendre un nouveau langage. | **Écarté** : Rego est extrêmement puissant mais surdimensionné pour ce projet. L'intégration Cosign est plus complexe. |

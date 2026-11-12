# SBOM (Software Bill of Materials)
The SBOM is generated on-the-fly by Syft via the GitHub Actions workflow (`anchore/sbom-action`).
The generated CycloneDX JSON is uploaded as a GitHub Actions artifact and attached to the container image via Cosign.

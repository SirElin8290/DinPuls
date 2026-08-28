(() => {
  "use strict";

  function initBannerPreviewSizing() {
    const input = document.querySelector("#bannerUpload");
    const preview = document.querySelector("#bannerPreview");
    if (!input || !preview) return;

    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file || !file.type.startsWith("image/")) return;

      const objectUrl = URL.createObjectURL(file);
      const probe = new Image();
      probe.onload = () => {
        const width = probe.naturalWidth || 1;
        const height = probe.naturalHeight || 1;
        const ratio = width / height;

        preview.style.setProperty("aspect-ratio", `${width} / ${height}`, "important");
        preview.style.setProperty("min-height", "0", "important");
        preview.style.setProperty("height", "auto", "important");
        preview.dataset.imageRatio = ratio.toFixed(4);

        requestAnimationFrame(() => {
          const image = preview.querySelector("img");
          if (!image) return;
          image.style.setProperty("width", "100%", "important");
          image.style.setProperty("height", "100%", "important");
          image.style.setProperty("max-height", "none", "important");
          image.style.setProperty("object-fit", "contain", "important");
          image.style.setProperty("object-position", "center", "important");
        });

        URL.revokeObjectURL(objectUrl);
      };
      probe.onerror = () => URL.revokeObjectURL(objectUrl);
      probe.src = objectUrl;
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initBannerPreviewSizing);
  } else {
    initBannerPreviewSizing();
  }
})();

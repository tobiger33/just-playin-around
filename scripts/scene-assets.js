"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { fileURLToPath } = require("node:url");
const { imageSize } = require("image-size");

const MIME_TYPES = {
  avif: "image/avif",
  gif: "image/gif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  svg: "image/svg+xml",
  webp: "image/webp",
};

function decodeDataUri(source) {
  const match = source.match(/^data:([^,]*?),(.*)$/s);
  if (!match) throw new Error("malformed data URI");
  const [mediaType = "", ...parameters] = match[1].split(";");
  const payload = parameters.includes("base64")
    ? Buffer.from(match[2], "base64")
    : Buffer.from(decodeURIComponent(match[2]));
  return { buffer: payload, mimeType: mediaType || "text/plain", remote: false };
}

function inspectAsset(source, scenePath) {
  if (source.startsWith("data:")) return decodeDataUri(source);
  if (/^https?:\/\//i.test(source)) return { remote: true, source };
  if (/^[a-z][a-z\d+.-]*:/i.test(source) && !source.startsWith("file:")) {
    throw new Error(`unsupported asset URL scheme in "${source}"`);
  }

  const assetPath = source.startsWith("file:")
    ? fileURLToPath(source)
    : path.resolve(path.dirname(scenePath), decodeURIComponent(source.split(/[?#]/, 1)[0]));
  const buffer = fs.readFileSync(assetPath);
  const dimensions = imageSize(buffer);
  const extension = path.extname(assetPath).slice(1).toLowerCase();
  const mimeType = MIME_TYPES[dimensions.type] || MIME_TYPES[extension];
  if (!mimeType) throw new Error(`unsupported image type for "${assetPath}"`);
  return { buffer, dimensions, mimeType, path: assetPath, remote: false };
}

function resolveSceneAssets(scene, scenePath) {
  const resolvedScene = structuredClone(scene);
  const assets = [];
  for (const layer of resolvedScene.layers) {
    let asset;
    try {
      asset = inspectAsset(layer.src, scenePath);
    } catch (error) {
      throw new Error(`layer "${layer.id}" asset "${layer.src}": ${error.message}`);
    }
    if (asset.remote) {
      assets.push({ id: layer.id, src: layer.src, remote: true });
      continue;
    }
    if (!asset.dimensions) {
      try {
        asset.dimensions = imageSize(asset.buffer);
      } catch (error) {
        throw new Error(`layer "${layer.id}" asset "${layer.src}" is not a readable image: ${error.message}`);
      }
    }
    if (!asset.dimensions.width || !asset.dimensions.height) {
      throw new Error(`layer "${layer.id}" asset "${layer.src}" has invalid image dimensions.`);
    }
    assets.push({
      id: layer.id,
      src: layer.src,
      path: asset.path,
      width: asset.dimensions.width,
      height: asset.dimensions.height,
      remote: false,
    });
    layer.src = `data:${asset.mimeType};base64,${asset.buffer.toString("base64")}`;
  }
  return { scene: resolvedScene, assets };
}

module.exports = { inspectAsset, resolveSceneAssets };

export async function gzip(bytes) {
  if (typeof CompressionStream !== 'function') {
    throw new Error('CompressionStream is not available in this browser');
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function gunzip(bytes) {
  if (typeof DecompressionStream !== 'function') {
    throw new Error('DecompressionStream is not available in this browser');
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

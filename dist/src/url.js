const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function normalizeTargetUrl(value, options = {}) {
  const { allowHttp = false } = options;
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('URLを入力してください');
  }

  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('URLの形式が正しくありません');
  }

  if (url.protocol === 'https:') {
    return url.href;
  }

  if (url.protocol === 'http:' && (allowHttp || LOCAL_HOSTS.has(url.hostname))) {
    return url.href;
  }

  throw new Error('転送先URLは https:// から始まるURLにしてください');
}

export function assertRedirectableUrl(value, options = {}) {
  return normalizeTargetUrl(value, options);
}

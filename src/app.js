import {
  createEncryptedCapsule,
  decodeCapsuleHash,
  decryptCapsuleWithKey,
  decryptCapsuleWithUnlockCode,
  makeShareUrl,
} from './capsule.js';
import { IndexedDbKeyStore } from './key-store.js';

const app = document.querySelector('#app');
const keyStore = new IndexedDbKeyStore();

window.addEventListener('hashchange', render);
render();

async function render() {
  const hash = window.location.hash;
  if (hash.startsWith('#v1.')) {
    await renderOpen(hash);
    return;
  }
  renderCreate();
}

function renderCreate() {
  app.innerHTML = `
    <h2>共有URLを作成</h2>
    <p class="status">転送先URLを圧縮・暗号化して、URLのhash部分に埋め込みます。解除コードは自動生成されます。</p>
    <form id="create-form" class="grid">
      <label>
        転送先URL
        <input name="url" type="url" inputmode="url" placeholder="https://example.com/secret-page" required />
        <small>通常は <code>https://</code> のURLだけを使ってください。</small>
      </label>
      <label>
        ラベル 任意
        <input name="label" type="text" maxlength="80" placeholder="例: プロジェクト資料" />
      </label>
      <div class="grid two">
        <label>
          有効期限 任意
          <input name="expiresAt" type="datetime-local" />
          <small>DBなしのため強制失効ではなく、復号後のクライアント側チェックです。</small>
        </label>
        <label class="checkbox">
          <input name="allowHttp" type="checkbox" />
          <span>http:// も許可する <small>ローカル開発・検証向け。通常はオフ推奨。</small></span>
        </label>
      </div>
      <div class="actions">
        <button type="submit">共有URLを生成</button>
      </div>
    </form>
    <div id="result"></div>
  `;

  document.querySelector('#create-form').addEventListener('submit', handleCreateSubmit);
}

async function handleCreateSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const result = document.querySelector('#result');
  const button = form.querySelector('button[type="submit"]');

  button.disabled = true;
  result.innerHTML = `<p class="status">生成中です...</p>`;

  try {
    const data = new FormData(form);
    const expiresAtRaw = data.get('expiresAt');
    const expiresAt = expiresAtRaw ? new Date(expiresAtRaw).toISOString() : undefined;
    const { capsule, unlockCode, key, payload } = await createEncryptedCapsule({
      url: data.get('url'),
      label: data.get('label'),
      expiresAt,
      allowHttp: data.get('allowHttp') === 'on',
    });

    await keyStore.set(capsule.kid, key);
    const shareUrl = makeShareUrl(window.location.href, capsule);

    result.innerHTML = `
      <div class="result">
        <p class="ok">生成しました。作成者のこのブラウザには復号鍵をIndexedDBへ保存済みです。</p>
        <label>
          共有URL
          <div class="output mono" id="share-url"></div>
        </label>
        <div class="actions">
          <button type="button" data-copy="#share-url">共有URLをコピー</button>
          <a class="button-link secondary" href="${escapeAttribute(shareUrl)}">このブラウザで開く</a>
        </div>
        <label>
          解除コード
          <div class="output mono" id="unlock-code"></div>
        </label>
        <div class="actions">
          <button type="button" data-copy="#unlock-code">解除コードをコピー</button>
        </div>
        <p class="hint">URLと解除コードは別経路で共有してください。復号先: ${escapeHtml(payload.label || payload.url)}</p>
      </div>
    `;

    document.querySelector('#share-url').textContent = shareUrl;
    document.querySelector('#unlock-code').textContent = unlockCode;
    result.querySelectorAll('[data-copy]').forEach((copyButton) => {
      copyButton.addEventListener('click', async () => {
        const selector = copyButton.getAttribute('data-copy');
        const text = document.querySelector(selector).textContent;
        await navigator.clipboard.writeText(text);
        const original = copyButton.textContent;
        copyButton.textContent = 'コピーしました';
        setTimeout(() => {
          copyButton.textContent = original;
        }, 1200);
      });
    });
  } catch (error) {
    result.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
  } finally {
    button.disabled = false;
  }
}

async function renderOpen(hash) {
  app.innerHTML = `<h2>共有URLを開いています</h2><p class="status">IndexedDBに保存済みの鍵を確認しています...</p>`;

  let capsule;
  try {
    capsule = decodeCapsuleHash(hash);
  } catch (error) {
    app.innerHTML = `<h2>共有URLを開けません</h2><p class="error">${escapeHtml(error.message)}</p><p><a class="button-link secondary" href="#create">作成画面へ戻る</a></p>`;
    return;
  }

  try {
    const savedKey = await keyStore.get(capsule.kid);
    if (savedKey) {
      const payload = await decryptCapsuleWithKey(capsule, savedKey);
      redirectTo(payload);
      return;
    }
  } catch {
    await keyStore.delete(capsule.kid).catch(() => {});
  }

  renderUnlockForm(capsule);
}

function renderUnlockForm(capsule) {
  app.innerHTML = `
    <h2>解除コードを入力</h2>
    <p class="status">この端末に保存済みの鍵がありません。共有された解除コードを入力してください。成功すると鍵をIndexedDBに保存し、次回から自動で開きます。</p>
    <form id="unlock-form" class="grid">
      <label>
        解除コード
        <input name="unlockCode" autocomplete="off" spellcheck="false" class="mono" placeholder="ABCDE-FGHJK-MNPQR-STUVW-XYZ23-45678" required />
      </label>
      <div class="actions">
        <button type="submit">復号して開く</button>
        <a class="button-link secondary" href="#create">作成画面へ</a>
      </div>
    </form>
    <div id="unlock-result"></div>
  `;

  document.querySelector('#unlock-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const result = document.querySelector('#unlock-result');
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    result.innerHTML = `<p class="status">復号中です...</p>`;

    try {
      const unlockCode = new FormData(form).get('unlockCode');
      const { payload, key } = await decryptCapsuleWithUnlockCode(capsule, unlockCode);
      await keyStore.set(capsule.kid, key);
      redirectTo(payload);
    } catch (error) {
      result.innerHTML = `<p class="error">解除コードが違うか、共有URLが壊れています。${escapeHtml(error.message)}</p>`;
      button.disabled = false;
    }
  });
}

function redirectTo(payload) {
  app.innerHTML = `
    <h2>復号しました</h2>
    <p class="ok">転送先へ移動します。</p>
    <p class="output mono">${escapeHtml(payload.url)}</p>
    <div class="actions">
      <a class="button-link" href="${escapeAttribute(payload.url)}" rel="noreferrer">今すぐ開く</a>
    </div>
  `;
  window.location.replace(payload.url);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll('`', '&#096;');
}

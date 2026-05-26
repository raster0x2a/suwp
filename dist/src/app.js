import {
  createEncryptedCapsule,
  decodeCapsuleHash,
  decryptCapsuleWithCandidateUnlockCodes,
  decryptCapsuleWithKey,
  decryptCapsuleWithUnlockCode,
  makeShareUrl,
} from './capsule.js';
import { IndexedDbKeyStore } from './key-store.js';
import { createDefaultUnlockCodeManager } from './default-unlock-code.js';

const app = document.querySelector('#app');
const credentialStore = new IndexedDbKeyStore();
const unlockCodeManager = createDefaultUnlockCodeManager({ store: credentialStore });

window.addEventListener('hashchange', render);
render();

async function render() {
  const hash = window.location.hash;
  if (hash.startsWith('#v1.')) {
    await renderOpen(hash);
    return;
  }
  await renderCreate();
}

async function renderCreate() {
  app.innerHTML = `<h2>共有URLを作成</h2><p class="status">解除コードを読み込んでいます...</p>`;

  try {
    await unlockCodeManager.initialize();
  } catch (error) {
    app.innerHTML = `<h2>共有URLを作成できません</h2><p class="error">解除コードの準備に失敗しました。${escapeHtml(error.message)}</p>`;
    return;
  }

  const savedCodes = await safeListUnlockCodes();

  app.innerHTML = `
    <h2>共有URLを作成</h2>
    <p class="status">転送先URLを圧縮・暗号化して、URLのhash部分に埋め込みます。既定の解除コードは、意図的に変更しない限り使い回されます。</p>
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
      <section class="unlock-code-panel" aria-label="解除コード">
        <div>
          <p class="panel-title">既定の解除コード</p>
          <p class="hint">仲間内で共有する固定コードです。URLやラベルを変えても、リロードしても、この端末では同じコードを使います。変えたい場合だけ「解除コードを再生成」を押してください。</p>
        </div>
        <div class="output mono" id="create-unlock-code"></div>
        <p class="hint" id="saved-code-count">保存済み解除コード: ${savedCodes.length}個。共有URLを開くときは、保存済みコードをすべて試します。</p>
        <div class="actions compact">
          <button type="button" class="secondary" id="regenerate-unlock-code">解除コードを再生成</button>
        </div>
      </section>
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

  updateCreateUnlockCodeDisplay();
  document.querySelector('#regenerate-unlock-code').addEventListener('click', async () => {
    const button = document.querySelector('#regenerate-unlock-code');
    button.disabled = true;
    try {
      await unlockCodeManager.regenerateUnlockCode();
      updateCreateUnlockCodeDisplay();
      const result = document.querySelector('#result');
      if (result) {
        result.innerHTML = '<p class="status">解除コードを再生成しました。次に作る共有URLから新しい既定コードを使います。</p>';
      }
      const savedCodeCount = document.querySelector('#saved-code-count');
      const updatedCodes = await safeListUnlockCodes();
      if (savedCodeCount) {
        savedCodeCount.textContent = `保存済み解除コード: ${updatedCodes.length}個。共有URLを開くときは、保存済みコードをすべて試します。`;
      }
    } catch (error) {
      const result = document.querySelector('#result');
      if (result) result.innerHTML = `<p class="error">解除コードの再生成に失敗しました。${escapeHtml(error.message)}</p>`;
    } finally {
      button.disabled = false;
    }
  });
  document.querySelector('#create-form').addEventListener('submit', handleCreateSubmit);
}

function updateCreateUnlockCodeDisplay() {
  const output = document.querySelector('#create-unlock-code');
  if (output) output.textContent = unlockCodeManager.getUnlockCode();
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
    const unlockCode = unlockCodeManager.getUnlockCode();
    const { capsule, key, payload } = await createEncryptedCapsule({
      url: data.get('url'),
      label: data.get('label'),
      expiresAt,
      allowHttp: data.get('allowHttp') === 'on',
      unlockCode,
    });

    await credentialStore.set(capsule.kid, key);
    await credentialStore.saveUnlockCode(unlockCode, { makeDefault: true });
    const shareUrl = makeShareUrl(window.location.href, capsule);

    result.innerHTML = `
      <div class="result">
        <p class="ok">生成しました。既定の解除コードで暗号化し、このブラウザには解除コードと復号鍵をIndexedDBへ保存済みです。</p>
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
  app.innerHTML = `<h2>共有URLを開いています</h2><p class="status">IndexedDBに保存済みの鍵と解除コードを確認しています...</p>`;

  let capsule;
  try {
    capsule = decodeCapsuleHash(hash);
  } catch (error) {
    app.innerHTML = `<h2>共有URLを開けません</h2><p class="error">${escapeHtml(error.message)}</p><p><a class="button-link secondary" href="#create">作成画面へ戻る</a></p>`;
    return;
  }

  try {
    const savedKey = await credentialStore.get(capsule.kid);
    if (savedKey) {
      const payload = await decryptCapsuleWithKey(capsule, savedKey);
      redirectTo(payload);
      return;
    }
  } catch {
    await credentialStore.delete(capsule.kid).catch(() => {});
  }

  try {
    const savedCodes = await credentialStore.listUnlockCodes();
    if (savedCodes.length > 0) {
      app.innerHTML = `<h2>共有URLを開いています</h2><p class="status">保存済みの解除コード ${savedCodes.length}個を順番に試しています...</p>`;
      const { payload, key } = await decryptCapsuleWithCandidateUnlockCodes(capsule, savedCodes);
      await credentialStore.set(capsule.kid, key);
      redirectTo(payload);
      return;
    }
  } catch {
    // Saved codes did not match this capsule. Fall back to manual input.
  }

  renderUnlockForm(capsule);
}

function renderUnlockForm(capsule) {
  app.innerHTML = `
    <h2>解除コードを入力</h2>
    <p class="status">この端末の保存済みコードでは開けませんでした。共有された解除コードを入力してください。成功するとコードをIndexedDBに保存し、次回から保存済みコードとして自動で試します。</p>
    <form id="unlock-form" class="grid">
      <label>
        解除コード
        <input name="unlockCode" autocomplete="off" spellcheck="false" class="mono" placeholder="ABCDE-FGHJK-MNPQR-STUVW-XYZ23-45678" required />
      </label>
      <label class="checkbox">
        <input name="makeDefault" type="checkbox" checked />
        <span>この解除コードを今後の作成でも使う <small>仲間内の固定コードとして使う場合はオンのままにしてください。</small></span>
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
      const formData = new FormData(form);
      const unlockCode = formData.get('unlockCode');
      const makeDefault = formData.get('makeDefault') === 'on';
      const { payload, key } = await decryptCapsuleWithUnlockCode(capsule, unlockCode);
      await credentialStore.set(capsule.kid, key);
      await unlockCodeManager.initialize().catch(() => {});
      await unlockCodeManager.rememberUnlockCode(unlockCode, { makeDefault });
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

async function safeListUnlockCodes() {
  try {
    return await credentialStore.listUnlockCodes();
  } catch {
    return [];
  }
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

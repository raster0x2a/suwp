# Secure URL Share for GitHub Pages

DBなしで動く、パスワード付きURLシェア用の静的Webアプリです。

- 転送先URLをブラウザ内でJSON化 → gzip圧縮 → AES-GCM暗号化
- 暗号化capsuleを共有URLの `#hash` に格納
- 解除コードは自動生成。作成画面を開いている間は明示的に再生成しない限り変わりません
- 復号鍵はIndexedDBに保存し、2回目以降は自動復号
- GitHub Pagesにそのまま公開可能

## ローカル実行

```bash
npm test
npm run serve
```

`npm run serve` 後、表示されたURLを開いてください。

## GitHub Pagesへの公開

1. このディレクトリの中身をGitHubリポジトリへpushします。
2. GitHubのリポジトリ画面で **Settings → Pages** を開きます。
3. **Build and deployment → Source** を **GitHub Actions** にします。
4. `main` ブランチへpushすると、`.github/workflows/pages.yml` がテスト後に `dist/` をデプロイします。

## 使い方

1. 作成画面で転送先URLを入力します。
2. 画面に表示されている解除コードを確認します。必要な場合だけ「解除コードを再生成」を押します。
3. 「共有URLを生成」を押します。同じ作成画面では、解除コードを再生成しない限り同じコードで暗号化されます。
4. 表示された共有URLと解除コードを別経路で相手に送ります。
5. 相手は初回だけ解除コードを入力します。
6. 成功後、その端末のIndexedDBに鍵が保存され、次回から自動で開きます。

## セキュリティ上の注意

- DBを使わないため、配布済みURLの強制失効はできません。
- 共有URLと解除コードが両方漏れると、転送先URLを復号できます。
- 解除コードはURLに含めないでください。
- 共有URLと解除コードは別経路で送ってください。
- GitHub Pagesは公開サイトとして配信されます。リポジトリに秘密情報を含めないでください。

## URL形式

```text
https://your-domain.example/#v1.<encrypted-capsule>
```

`#` 以降に暗号化済みデータを含めます。ブラウザ側で復号するため、サーバーやDBは不要です。

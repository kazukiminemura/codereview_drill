# コードレビュードリル

## 共通の回答フォーマット
各ドリルで、次の形式を埋めてください。
判定：採用 / 条件付き採用 / 却下

重大度：Critical / High / Medium / Low

問題点：
1.
2.
3.

発生条件：

想定される影響：

修正方針：

追加すべきテスト：
採点は次の基準です。
問題を見つける：1点
発生条件を説明する：1点
影響を説明する：1点
適切な修正方針を出す：1点
テストケースを出す：1点
各ドリル5点、合計40点です。
## ドリル1：外部API通信

**目安時間：15分**

```python
import requests


def get_opportunity(opportunity_id: str) -> dict:
    url = (
        "https://crm.example.invalid/"
        f"api/v1/opportunities/{opportunity_id}"
    )

    response = requests.get(
        url,
        headers={
            "Authorization": "Bearer secret-token",
        },
    )

    return response.json()
```

### レビュー課題
最低でも5個、問題を見つけてください。
特に次の観点を確認します。
認証情報
タイムアウト
HTTPエラー
入力値
戻り値
テスト可能性
### 追加課題
次の状況で、このコードがどうなるか説明してください。
1. 外部CRMサービスが30秒間応答しない
2. 401 Unauthorizedが返る
3. HTMLのログイン画面が返る
4. opportunity_idに「../users」が渡される
5. JSON配列が返る
## ドリル2：例外を握りつぶすコード

**目安時間：10分**

```python
import json
from pathlib import Path


def load_config(path: str) -> dict:
    try:
        text = Path(path).read_text()
        return json.loads(text)
    except Exception:
        return {}
```

### レビュー課題
このコードは一見、安全に見えます。
しかし、設定ファイルが壊れている場合にも空の設定を返します。
次を判断してください。
このコードを採用できるか
FileNotFoundErrorとJSON形式エラーを同じ扱いにしてよいか
空の設定で処理を続ける危険性
エラーメッセージに何を含めるべきか
### 修正条件
次の仕様を満たす修正版を考えてください。
- ファイルがない場合はデフォルト設定を返す
- JSONが壊れている場合は処理を停止する
- UTF-8で読み込む
- JSONのトップレベルがdictでなければ拒否する
## ドリル3：ログへの秘密情報漏えい

**目安時間：15分**

```python
import logging
import requests


logger = logging.getLogger(__name__)


def call_api(url: str, token: str) -> dict:
    headers = {
        "Authorization": f"Bearer {token}",
    }

    logger.info("Request URL: %s", url)
    logger.debug("Request headers: %s", headers)

    response = requests.get(url, headers=headers)

    logger.info(
        "Response: status=%s body=%s",
        response.status_code,
        response.text,
    )

    return response.json()
```

### レビュー課題
ログに出してはいけない可能性がある情報を列挙してください。
例として、URLが次の場合を考えます。
`https://api.example.invalid/api?session_id=abc123&customer=sample-company`
レスポンスが次の場合も考えてください。

```json
{
  "customer_name": "Sample Customer",
  "email": "user@example.invalid",
  "access_token": "secret"
}
```

### 追加課題
安全なログを設計してください。
次の情報は残す必要があります。
リクエスト先ホスト
HTTPメソッド
ステータスコード
処理時間
リクエスト追跡ID
ただし、次は残してはいけません。
トークン
Cookie
セッションID
メールアドレス
APIレスポンス全文
## ドリル4：Playwrightの不安定な待機

**目安時間：15分**

```python
from playwright.sync_api import Page


def open_opportunity(page: Page, opportunity_name: str) -> None:
    page.goto("https://crm-app.example.invalid/")

    page.wait_for_timeout(5000)

    page.locator("input").fill(opportunity_name)

    page.wait_for_timeout(3000)

    page.locator("a").first.click()

    page.wait_for_timeout(5000)
```

### レビュー課題
このコードが不安定になる理由を最低5個挙げてください。
特に次を確認します。
固定時間待機
セレクター
画面遷移
同名Opportunity
ログイン切れ
処理完了の判定
### 修正方針
コードそのものではなく、まず設計方針を書いてください。
1. 何が表示されるまで待つか
2. どの属性で要素を特定するか
3. 検索結果が0件の場合
4. 複数件の場合
5. セッション切れの場合
重要なのは、単に待機時間を10秒に増やすことではありません。
それは修正ではなく、失敗を遅らせているだけです。
## ドリル5：二重実行に弱いエージェント

**目安時間：20分**

```python
def process_email(email, crm, mailer):
    customer = crm.find_customer(email.sender)

    crm.create_case(
        customer_id=customer["id"],
        subject=email.subject,
        body=email.body,
    )

    mailer.send(
        to=email.sender,
        subject="お問い合わせを受け付けました",
        body="担当者からご連絡します。",
    )

    return {"status": "completed"}
```

### レビュー課題
この処理が途中で失敗した場合を考えてください。
ケースA
外部CRMサービスのCase作成は成功
メール送信は失敗
再実行すると何が起きますか。
ケースB
メール送信は成功
その直後にプロセスがクラッシュ
再実行すると何が起きますか。
### 考えるべき設計
冪等性
処理状態
重複Case
重複メール
再実行
トランザクション
外部システム間の整合性
### 修正課題
次の情報を保存する設計を考えてください。
email_message_id
case_id
case_created_at
reply_sent_at
processing_status
last_error
retry_count
## ドリル6：AIエージェントの危険なツール実行

**目安時間：20分**

```python
TOOLS = {
    "read_file": read_file,
    "delete_file": delete_file,
    "send_email": send_email,
    "run_command": run_command,
}


def execute_tool(tool_name: str, arguments: dict):
    tool = TOOLS[tool_name]
    return tool(**arguments)
```

LLMが次の出力を返したとします。

```json
{
  "tool_name": "run_command",
  "arguments": {
    "command": "rm -rf /tmp/project"
  }
}
```

### レビュー課題
この実装を本番環境に入れてよいか判断してください。
最低でも次を検討します。
ツール名の検証
引数の型検証
権限分離
読み取り操作と書き込み操作
人間の承認
実行可能コマンド
実行ディレクトリ
タイムアウト
監査ログ
プロンプトインジェクション
### 分類課題
次の操作を分類してください。

| 操作 | 自動実行 | 承認必要 | 禁止 |
|---|:---:|:---:|:---:|
| ファイル一覧取得 |  |  |  |
| ログファイル読み取り |  |  |  |
| メール下書き作成 |  |  |  |
| メール送信 |  |  |  |
| CRMレコード更新 |  |  |  |
| ファイル削除 |  |  |  |
| 任意のシェルコマンド |  |  |  |

正解は一律ではありません。
ただし、「すべて自動実行」は危険な設計です。
## ドリル7：誤った性能測定

**目安時間：20分**

```python
import time


def benchmark(model, inputs):
    start = time.time()

    for input_data in inputs:
        model.generate(input_data)

    elapsed = time.time() - start

    return len(inputs) / elapsed
```

### レビュー課題
このコードが「推論性能」を正確に測れない理由を挙げてください。
最低でも次を検討します。
ウォームアップ
入力トークン数
出力トークン数
バッチサイズ
モデルロード
GPU/NPUの非同期実行
キャッシュ
平均値
p50、p95
TTFTとTPS
### 追加課題
次の二つを別々に測定する設計を考えてください。
1. Time to First Token
2. Decode Tokens Per Second
また、次の条件を記録すべき理由を説明してください。
モデル名
量子化方式
入力長
出力長
バッチサイズ
デバイス
ドライババージョン
ウォームアップ回数
測定回数
温度
キャッシュ利用
## ドリル8：並行処理の競合

**目安時間：20分**

```python
from concurrent.futures import ThreadPoolExecutor


processed_count = 0


def process_item(item):
    global processed_count

    result = expensive_operation(item)

    processed_count += 1

    return result


def run(items):
    with ThreadPoolExecutor(max_workers=8) as executor:
        return list(executor.map(process_item, items))
```

### レビュー課題
次を考えてください。
processed_countは常に正しい値になるか
expensive_operation()が例外を投げた場合
一つの処理が永久に終わらない場合
1万件を一度に渡した場合
処理順序が重要な場合
同じitemが複数回含まれていた場合
### 修正課題
次のどれを選ぶか、理由を書いてください。
A. Lockを使う
B. 各処理の結果から最後に件数を計算する
C. Queueを使う
D. グローバル変数を残す
多くの場合、最善はBです。
共有状態を安全にするより、共有状態そのものをなくす方が単純で壊れにくいためです。
## 実践ドリル：AIにレビューさせた後の判定
最後に、AIへ次のプロンプトを渡してください。

```text
以下のコードをレビューしてください。

セキュリティ、正確性、例外処理、テスト可能性、
保守性、並行実行、外部サービス障害の観点で、
問題点を重大度付きで列挙してください。

修正版コードはまだ出さないでください。
```

AIの回答を受け取ったら、各指摘を次の表に分類します。

| AIの指摘 | 自分の判定 | 理由 |
|---|---|---|
|  | 採用 |  |
|  | 不採用 |  |
|  | 今回は対応不要 |  |
|  | 判断保留 |  |

ここで、AIの指摘をすべて採用するのは良いレビューではありません。
AIはしばしば次のような過剰設計を提案します。
小規模スクリプトに複雑なクラス階層を導入する
不要なリトライを追加する
あらゆる場所に独自例外を作る
実際には不要な非同期処理を導入する
単純な処理を細かく分割しすぎる
レビュー能力とは、問題をたくさん挙げる能力ではなく、現在の用途に対して本当に直す価値があるか判断する能力です。
## 4週間の進め方

### 第1週
ドリル1：API通信
ドリル2：例外処理
目標は、正常系だけでなく失敗条件を見ることです。
### 第2週
ドリル3：ログ
ドリル4：Playwright
目標は、セキュリティと不安定性を見抜くことです。
### 第3週
ドリル5：冪等性
ドリル6：AIエージェント
目標は、副作用と権限制御を理解することです。
### 第4週
ドリル7：性能測定
ドリル8：並行処理
目標は、数字や実行結果を無条件に信用しないことです。
まずはドリル1の回答だけ作り、コードを修正する前に問題点と却下理由を書いてください。修正を急ぐ癖があると、設計上の問題を見逃しやすくなります。

# 开启 GitHub 登录（可选）

评论**不需要登录**也能发：留言者填个昵称，本站就给他发一个签名 cookie 当身份。

GitHub 登录只是**升级项**——登录后不用每次填昵称，评论会带上 GitHub 头像和用户名。

没配置时：接口返回 `501 GitHub OAuth not configured`，评论框里**不会显示**登录按钮（自动隐藏，不会误导访客）。

---

## 1. 建一个 GitHub OAuth App

GitHub 的 REST API **不支持**创建 OAuth App，只能在网页上建：

1. 打开 <https://github.com/settings/applications/new>
2. 填写：

| 字段 | 填什么 |
|---|---|
| Application name | `my-site`（随便填，只有你自己看得到） |
| Homepage URL | `https://your-domain` |
| Authorization callback URL | `https://your-domain/api/auth/github/callback` |

3. 点 **Register application**
4. 记下 **Client ID**；再点 **Generate a new client secret**，记下 **Client secret**（只显示一次）

> callback URL 必须**完全一致**（`https`、结尾没有斜杠），否则 GitHub 报 `redirect_uri_mismatch`。

---

## 2. 写入密钥

线上（Cloudflare Worker）：

```bash
cd your-project
npx wrangler secret put GITHUB_CLIENT_ID      # 粘贴 Client ID，回车
npx wrangler secret put GITHUB_CLIENT_SECRET  # 粘贴 Client secret，回车
```

本地开发（写进 `.dev.vars`，这个文件不进 git）：

```
GITHUB_CLIENT_ID=xxxxxxxx
GITHUB_CLIENT_SECRET=xxxxxxxx
```

Worker secret 写完立刻生效，不用重新部署；本地改 `.dev.vars` 需要重启 `pnpm dev`。

---

## 3. 验证

```bash
# 1) 是否认到配置（githubLogin 应为 true）
curl -s https://your-domain/api/auth/session
# 预期：{"role":"visitor","isOwner":false,"githubLogin":true,"actor":null}

# 2) 是否跳去 GitHub 授权页（302）
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' https://your-domain/api/auth/github
# 预期：302 https://github.com/login/oauth/authorize?client_id=...&redirect_uri=...&state=...

# 3) 伪造 state 必须被拒（防 CSRF）
curl -s -o /dev/null -w '%{http_code}\n' 'https://your-domain/api/auth/github/callback?code=x&state=y'
# 预期：400
```

浏览器里走一遍：打开任意文章 → 评论框出现「用 GitHub 登录」→ 点它 → 在 GitHub 授权 → 回到**刚才那篇文章**（不是首页）→ 评论框变成「以 <你的名字> 身份评论 · 退出」。

---

## 4. 演示站 demo.your-domain

一个 OAuth App 只能填**一个** callback URL。演示站要登录，就再建一个 App（callback 填
`https://demo.your-domain/api/auth/github/callback`），然后：

```bash
npx wrangler secret put GITHUB_CLIENT_ID --config wrangler.demo.toml
npx wrangler secret put GITHUB_CLIENT_SECRET --config wrangler.demo.toml
```

---

## 5. 设计说明（为什么这么做）

| 决定 | 原因 |
|---|---|
| 登录是可选的，匿名优先 | 评论门槛越低越好；登录只用来"记住你是谁" |
| 身份存本地 `actors` 表，**不存** GitHub token | GitHub 只是身份来源之一；换平台不影响已有评论 |
| `state` 放 cookie 并逐一校验 | 防 CSRF |
| `?next=` 只接受站内路径 | 防开放重定向：`//evil.com`、`https://…`、`/\evil`、换行 全部拒绝（`tests/auth.test.js` 有覆盖） |
| 回跳目标存在 10 分钟过期的 httpOnly cookie | 不用把业务数据塞进 state；默认回首页 |

---

## 6. 常见错误

| 现象 | 原因 | 处理 |
|---|---|---|
| 起始跳转 302 正常，但 `/callback` 和 `/api/auth/session` 仍是 501 / `githubLogin:false` | 两个密钥只写进了一个，或者**名字带了多余字符**（真实的坑：复制命令时把后面的中文括号「（」一起带进去了） | 用下面的自检命令核对 |
| 点登录后 GitHub 报 `redirect_uri_mismatch` | App 里填的 callback 与线上不一致 | 必须**完全**等于 `https://your-domain/api/auth/github/callback`（https、结尾无斜杠） |
| 登录后回到首页而不是原文章 | 起始链接少了 `?next=` | 用评论框里的按钮（自动带上当前路径） |

密钥名自检（名字必须是**纯 ASCII**：大小写一致、无空格、无括号）：

```bash
npx wrangler secret list | python3 -c "import sys,json,re;ns=[s['name'] for s in json.loads(re.search(r'\[[\s\S]*\]',sys.stdin.read()).group(0))];bad=[n for n in ns if not n.isascii()];print('异常名字:', bad if bad else '无')"
# 期望：异常名字: 无
# 期望列表：ADMIN_TOKEN / GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET / IP_HASH_SALT / SESSION_SECRET
```

名字写错了就删掉重设（`<错名>` 换成实际名字，**加引号**）：

```bash
npx wrangler secret delete '<错名>'
npx wrangler secret put GITHUB_CLIENT_SECRET   # 交互式粘贴值；名字手敲，别从带括号的句子里复制
```

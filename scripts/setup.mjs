#!/usr/bin/env node
/**
 * sprout — 一键部署向导
 *
 * D1 / R2 的创建需要账号权限和交互确认，所以"一键"的准确含义是
 * **一条命令 + 几次回车**。做完了什么：
 *
 *   1. 检查 wrangler 登录
 *   2. 创建 D1 数据库       → 把 database_id 写回 wrangler.toml
 *   3. 创建 R2 存储桶       → 把 bucket_name 写回 wrangler.toml
 *   4. 生成并上传三个密钥   （ADMIN_TOKEN / SESSION_SECRET / IP_HASH_SALT）
 *   5. 写本地 .dev.vars
 *   6. 远端建表
 *   7. 告诉你怎么部署、怎么登录后台
 *
 * 用法：
 *   pnpm bootstrap                  # 交互式
 *   pnpm bootstrap --dry-run        # 只打印将要做什么，不改任何东西
 *   pnpm bootstrap --name my-site --db my-site-db --bucket my-site-media
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { site } from '../src/site.config.js';

const argv = process.argv.slice(2);
const flag = (name) => {
	const i = argv.indexOf(`--${name}`);
	return i !== -1 ? argv[i + 1] : undefined;
};
const dryRun = argv.includes('--dry-run');

const WRANGLER = existsSync('wrangler.toml') ? readFileSync('wrangler.toml', 'utf8') : '';

/** @param {string} re @param {string} fallback */
function current(re, fallback) {
	const m = WRANGLER.match(re);
	return m ? m[1] : fallback;
}

const defaults = {
	name: flag('name') ?? current(/^name\s*=\s*"([^"]+)"/m, 'my-site'),
	db: flag('db') ?? current(/database_name\s*=\s*"([^"]+)"/m, 'my-site-db'),
	bucket: flag('bucket') ?? current(/bucket_name\s*=\s*"([^"]+)"/m, 'my-site-media')
};

const rl = createInterface({ input: stdin, output: stdout });

/** @param {string} label @param {string} defaultValue */
async function ask(label, defaultValue) {
	// Non-interactive shells (CI, piping) fall back to the defaults/flags.
	if (!stdin.isTTY) {
		console.log(`  ${label} = ${defaultValue}  (非交互模式，使用默认值)`);
		return defaultValue;
	}
	const answer = (await rl.question(`  ${label} [${defaultValue}]: `)).trim();
	return answer || defaultValue;
}

/** @param {string[]} args @param {string} [input] */
function wrangler(args, input) {
	if (dryRun) {
		console.log(`  [dry-run] wrangler ${args.join(' ')}`);
		return '';
	}
	return execFileSync('pnpm', ['exec', 'wrangler', ...args], {
		input,
		encoding: 'utf8',
		stdio: input === undefined ? ['inherit', 'pipe', 'inherit'] : ['pipe', 'pipe', 'inherit']
	});
}

console.log('\n sprout setup\n' + '─'.repeat(50));

// 1. auth
if (!dryRun) {
	try {
		wrangler(['whoami']);
	} catch {
		console.error('✗ 没有登录 Cloudflare。先运行：pnpm exec wrangler login');
		process.exit(1);
	}
	console.log('✓ Cloudflare 已登录');
} else {
	console.log('[dry-run] 跳过 wrangler whoami');
}

// 2. names
console.log('\n① 资源命名');
const name = await ask('Worker 名称', defaults.name);
const dbName = await ask('D1 数据库名', defaults.db);
const bucket = await ask('R2 存储桶名', defaults.bucket);
rl.close();

// 3. create D1
console.log('\n② 创建 D1 数据库');
let databaseId = 'YOUR_D1_DATABASE_ID';
if (dryRun) {
	console.log(`  [dry-run] wrangler d1 create ${dbName}`);
} else {
	const out = wrangler(['d1', 'create', dbName]);
	const m = out.match(/database_id\s*=\s*"([^"]+)"/);
	if (!m) {
		console.error('✗ 无法从输出里解析 database_id。请手动创建并填回 wrangler.toml。');
		console.error(out);
		process.exit(1);
	}
	databaseId = m[1];
	console.log(`✓ database_id = ${databaseId}`);
}

// 4. create R2
console.log('\n③ 创建 R2 存储桶');
try {
	wrangler(['r2', 'bucket', 'create', bucket]);
	if (!dryRun) console.log(`✓ 存储桶 ${bucket}`);
} catch (err) {
	console.log(`  (可能已存在，继续) ${String(err).split('\n')[0]}`);
}

// 5. patch wrangler.toml
console.log('\n④ 写回 wrangler.toml');
let config = WRANGLER;
config = config.replace(/^name\s*=\s*"[^"]*"/m, `name = "${name}"`);
config = config.replace(/database_name\s*=\s*"[^"]*"/, `database_name = "${dbName}"`);
config = config.replace(/database_id\s*=\s*"[^"]*"/, `database_id = "${databaseId}"`);
config = config.replace(/bucket_name\s*=\s*"[^"]*"/, `bucket_name = "${bucket}"`);
if (dryRun) {
	console.log('  [dry-run] 将写入上面这些值');
} else {
	writeFileSync('wrangler.toml', config);
	console.log('✓ 已更新 wrangler.toml');
}

// 6. secrets
console.log('\n⑤ 生成并上传密钥');
const secrets = {
	ADMIN_TOKEN: randomBytes(32).toString('hex'),
	SESSION_SECRET: randomBytes(32).toString('hex'),
	IP_HASH_SALT: randomBytes(16).toString('hex')
};
for (const [key, value] of Object.entries(secrets)) {
	wrangler(['secret', 'put', key], value);
	if (!dryRun) console.log(`✓ ${key}`);
}

// 7. local dev vars
console.log('\n⑥ 写入本地 .dev.vars（已被 .gitignore 忽略）');
if (dryRun) {
	console.log('  [dry-run] 将写入 .dev.vars');
} else {
	writeFileSync(
		'.dev.vars',
		`ADMIN_TOKEN=${secrets.ADMIN_TOKEN}\nSESSION_SECRET=${secrets.SESSION_SECRET}\nIP_HASH_SALT=${secrets.IP_HASH_SALT}\n`
	);
	console.log('✓ .dev.vars');
}

// 8. migrate
console.log('\n⑦ 远端建表');
wrangler(['d1', 'migrations', 'apply', 'DB', '--remote']);
if (!dryRun) console.log('✓ 迁移已应用');

// 9. done
console.log('\n' + '─'.repeat(50));
console.log(' 完成。接下来：\n');
console.log('   1) 在 src/site.config.js 填上你的站点名与域名（当前：');
console.log(`      name = "${site.name}"   url = "${site.url}"）`);
console.log('   2) 在 src/sprout.config.js 声明内容类型 / 能力 / 首页区块 / 主题');
console.log('   3) 构建并部署：  pnpm build && pnpm run deploy');
console.log('   4) 打开 /admin 登录，令牌就是 .dev.vars 里的 ADMIN_TOKEN');
console.log('   5) 迁移已有内容： ADMIN_TOKEN=… API_URL=https://你的域名 pnpm content:import');
console.log('\n 本地开发： pnpm dev');
console.log(' 数据备份： pnpm content:export   （见 docs/VERIFY.md）\n');

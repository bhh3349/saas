#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
餐饮收银 SaaS — 远程部署编排脚本（本地运行，不上传服务器）
用法:
  SSH_PASSWORD=xxx python deploy_remote.py probe   # 仅探测服务器环境
  SSH_PASSWORD=xxx python deploy_remote.py upload  # 上传 scripts + 服务源码
  SSH_PASSWORD=xxx python deploy_remote.py run     # 依次执行 01-05
  SSH_PASSWORD=xxx python deploy_remote.py verify  # 验证部署结果
  SSH_PASSWORD=xxx python deploy_remote.py all     # upload + run + verify
"""
import os
import stat
import sys
import time

import paramiko

HOST = "140.143.201.204"
USER = "root"
PASSWORD = os.environ.get("SSH_PASSWORD", "")
LOCAL_SCRIPTS = r"D:\c\saas\scripts\deploy"
LOCAL_OUTPUT = r"D:\c\saas\output"
REMOTE_SCRIPTS = "/opt/saas/scripts"
REMOTE_OUTPUT = "/opt/saas/output"
EXCLUDE_DIRS = {"node_modules", "dist", "data", ".git", ".env", "__pycache__"}


def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def exec_cmd(client, cmd, timeout=1800, quiet=False):
    """执行远程命令，返回 (rc, out)。超时由 channel recv 控制。"""
    log(f"$ {cmd}")
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout, get_pty=False)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    rc = stdout.channel.recv_exit_status()
    if not quiet:
        if out.strip():
            print(out.rstrip())
        if err.strip():
            print("[stderr]", err.rstrip()[:4000])
    if rc != 0:
        log(f"!! 命令退出码 {rc}")
    return rc, out, err


def connect():
    if not PASSWORD:
        log("缺少 SSH_PASSWORD 环境变量")
        sys.exit(2)
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    log(f"连接 {USER}@{HOST} ...")
    c.connect(HOST, username=USER, password=PASSWORD, timeout=30, banner_timeout=30, auth_timeout=30)
    log("连接成功")
    return c


def sftp_upload_dir(sftp, local, remote, excludes=None):
    """递归上传目录，排除指定子目录。返回上传文件数。"""
    excludes = excludes or set()
    count = [0]

    def walk(lpath, rpath):
        for name in os.listdir(lpath):
            if name in excludes:
                log(f"跳过 {rpath}/{name}")
                continue
            lp = os.path.join(lpath, name)
            rp = rpath + "/" + name
            if os.path.isdir(lp):
                try:
                    sftp.stat(rp)
                except FileNotFoundError:
                    sftp.mkdir(rp)
                walk(lp, rp)
            else:
                sftp.put(lp, rp)
                count[0] += 1

    try:
        sftp.stat(remote)
    except FileNotFoundError:
        sftp.mkdir(remote)
    walk(local, remote)
    return count[0]


def probe(client):
    log("===== 探测服务器环境 =====")
    exec_cmd(client, "cat /etc/os-release | head -3")
    exec_cmd(client, "hostname && uname -m && uptime")
    exec_cmd(client, "df -h / | tail -1 && free -m | head -2")
    exec_cmd(client, "ls -la /opt/saas 2>/dev/null || echo '>>> /opt/saas 不存在（全新部署）'")
    exec_cmd(client, "ls /opt/saas/output 2>/dev/null || echo '>>> 无已上传代码'")
    exec_cmd(client, "ls /etc/nginx/sites-enabled/ 2>/dev/null || echo '>>> nginx 未安装/未启用站点'")
    exec_cmd(client, "node -v 2>/dev/null || echo '>>> node 未安装'")
    exec_cmd(client, "pm2 -v 2>/dev/null || echo '>>> pm2 未安装'")
    exec_cmd(client, "ss -tlnp 2>/dev/null | grep -E ':(80|3100|3200|443)\\s' || echo '>>> 80/3100/3200/443 无监听'")


def upload(client):
    log("===== 上传 =====")
    rc, _, _ = exec_cmd(client, "mkdir -p /opt/saas/scripts /opt/saas/output && echo OK", quiet=True)
    sftp = client.open_sftp()
    try:
        n1 = sftp_upload_dir(sftp, LOCAL_SCRIPTS, REMOTE_SCRIPTS, excludes=set())
        log(f"已上传 scripts/deploy：{n1} 个文件")
        for svc in ("platform-service", "saas-service"):
            n = sftp_upload_dir(sftp, os.path.join(LOCAL_OUTPUT, svc),
                                f"{REMOTE_OUTPUT}/{svc}", excludes=EXCLUDE_DIRS)
            log(f"已上传 {svc}：{n} 个文件")
    finally:
        sftp.close()
    log("上传完成")


def run_scripts(client):
    log("===== 执行部署脚本 =====")
    scripts = [
        ("01-apt-tencent.sh", "切换 apt 腾讯云内网源 + 安装基础软件"),
        ("02-install-node.sh", "安装 Node 22 + npm 镜像 + pm2"),
        ("03-deploy.sh", "安装依赖/构建/生成 .env/pm2 启动"),
        ("04-nginx.sh", "Nginx 反代配置"),
        ("05-backup.sh", "每日备份 crontab"),
    ]
    start = os.environ.get("START_SCRIPT", "")
    started = not start
    for name, desc in scripts:
        if name == start:
            started = True
        if not started:
            log(f"跳过 {name}（START_SCRIPT={start}）")
            continue
        log(f"===== 执行 {name}（{desc}） =====")
        rc, _, _ = exec_cmd(client, f"cd {REMOTE_SCRIPTS} && bash {name}", timeout=3600)
        if rc != 0:
            log(f"!!! {name} 失败，终止后续执行")
            sys.exit(1)
    log("全部脚本执行完成")


def verify(client):
    log("===== 验证 =====")
    exec_cmd(client, "pm2 status")
    exec_cmd(client, "curl -s -o /dev/null -w 'platform /auth/login -> %{http_code}\\n' -X POST http://127.0.0.1:3100/auth/login -H 'Content-Type: application/json' -d '{}'")
    exec_cmd(client, "curl -s -o /dev/null -w 'saas /auth/login -> %{http_code}\\n' -X POST http://127.0.0.1:3200/auth/login -H 'Content-Type: application/json' -d '{}'")
    exec_cmd(client, "curl -s -o /dev/null -w 'nginx /admin/ -> %{http_code}\\n' http://127.0.0.1/admin/")
    exec_cmd(client, "crontab -l | grep backup || echo '>>> 无备份 crontab'")
    exec_cmd(client, "ls /opt/saas/backups/ 2>/dev/null && ls /opt/saas/logs/ 2>/dev/null")
    log("验证完成")


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "all"
    client = connect()
    try:
        if mode in ("probe", "all"):
            probe(client)
        if mode in ("upload", "all"):
            upload(client)
        if mode in ("run", "all"):
            run_scripts(client)
        if mode in ("verify", "all"):
            verify(client)
    finally:
        client.close()
    log("===== 完成 =====")


if __name__ == "__main__":
    main()

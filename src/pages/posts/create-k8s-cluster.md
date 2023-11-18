---
layout: ../../layouts/MarkdownPostLayout.astro
title: "kubernetesクラスタを作成する"
pubDate: 2022-03-19
description: "前回作成したVMにkubernetesをインストールしてクラスタを作成してきます"
author: "taamgo0224"
image:
  url: https://docs.astro.build/assets/full-logo-light.png
  alt: Astroのロゴ
tags: ["kubernetes", "memo"]
---
# kubernetesクラスタを作成する

## 概要

Ubuntu 20.04のホストを使って、kubernetes 1.23.5でクラスタを作成していきます。
クラスタ作成のために使うツールは`kubeadm`を使って行います。

### クラスタとして使うVM情報

|VM名|メモリ|CPU|ディスク|
|:---|:---|:---|:---|
|k8s-master01|8GB|4|500GB|
|k8s-worker01|8GB|4|500GB|
|k8s-worker02|8GB|4|500GB|
|k8s-worker03|8GB|4|500GB|


## 手順

### 各ノードへの操作

本章の手順はkubernetesのクラスタに参加させるホストすべてに必要な操作です。

#### はじめに

スワップを無効にします。

```bash
$ sudo swapoff -a
```

#### iptablesのブリッジネットワークの有効化

`br_netfilter`モジュールがロードされていることを確認する。

```bash
$ lsmod | grep br_netfilter
```

読み込まれていない（出力がない）場合は`sudo modprobe br_netfilter`で明示的に読み込みを行う。

iptablesがブリッジのネットワークトラフィックを処理できるように、設定ファイルを書き換えます。

```bash
$ cat <<EOF | sudo tee /etc/modules-load.d/k8s.conf
br_netfilter
EOF
$ cat <<EOF | sudo tee /etc/sysctl.d/k8s.conf
net.bridge.bridge-nf-call-ip6tables = 1
net.bridge.bridge-nf-call-iptables = 1
EOF
$ sudo sysctl --system
```

#### コンテナランタイムのインストール

今回は`containerd`を kubernetes のコンテナランタイムとして使用するので、こちらをインストールしていきます。

まずはcontainerdをシステムへインストールするのに必要な設定を行います。

```bash
$ cat <<EOF | sudo tee /etc/modules-load.d/containerd.conf
overlay
br_netfilter
EOF

$ sudo modprobe overlay
$ sudo modprobe br_netfilter

# Setup required sysctl params, these persist across reboots.
$ cat <<EOF | sudo tee /etc/sysctl.d/99-kubernetes-cri.conf
net.bridge.bridge-nf-call-iptables  = 1
net.ipv4.ip_forward                 = 1
net.bridge.bridge-nf-call-ip6tables = 1
EOF

# Apply sysctl params without reboot
$ sudo sysctl --system
```

次に、`containerd`のインストールです。

```bash
$ sudo apt update && sudo apt install -y apt-transport-https ca-certificates curl software-properties-common
$ curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
$ sudo add-apt-repository \
    "deb [arch=amd64] https://download.docker.com/linux/ubuntu \
    $(lsb_release -cs) \
    stable"
$ sudo apt update && sudo apt install -y containerd.io
$ sudo mkdir -p /etc/containerd
$ containerd config default | sudo tee /etc/containerd/config.toml
```

`containerd`でcgroupはsystemdのものを使うために、設定ファイルを修正します。
上の手順で書き換えた設定ファイルの`[plugins."io.containerd.grpc.v1.cri".containerd.runtimes.runc.options]`セクションにある`SystemdCgroup`プロパティを`true`に書き換えて再起動させます。

```$bash
$ sudo systemctl restart containerd
```

#### kubeadm/kubelet/kubectl のインストール

下記コマンドでkubernetesのツール群をインストールします。

```bash
# Update the apt package index and install packages needed to use the Kubernetes apt repository:
$ sudo apt update
$ sudo apt install -y apt-transport-https ca-certificates curl

# Download the Google Cloud public signing key:
$ sudo curl -fsSLo /usr/share/keyrings/kubernetes-archive-keyring.gpg https://packages.cloud.google.com/apt/doc/apt-key.gpg

# Add the Kubernetes apt repository:
$ echo "deb [signed-by=/usr/share/keyrings/kubernetes-archive-keyring.gpg] https://apt.kubernetes.io/ kubernetes-xenial main" | sudo tee /etc/apt/sources.list.d/kubernetes.list

# Update apt package index, install kubelet, kubeadm and kubectl, and pin their version
$ sudo apt update && sudo apt install -y kubelet kubeadm kubectl
$ sudo apt-mark hold kubelet kubeadm kubectl
```

これでホストの初期設定は完了です。

### masterノードを構築する

#### masterノードを初期化する

`kubeadm init`実行時に引数に指定する設定ファイルを用意します。
このファイルはmasterノードで使うのでホストに配置しておいてください。

```yaml
# kubeadm-config.yaml
kind: ClusterConfiguration
apiVersion: kubeadm.k8s.io/v1beta3
kubernetesVersion: v1.23.5
networking:
        podSubnet: "172.16.0.0/16"
---
kind: KubeletConfiguration
apiVersion: kubelet.config.k8s.io/v1beta1
cgroupDriver: systemd
```

masterノードでkubeadm初期化処理を実行

```bash
$ sudo kubeadm init --config kubeadm-config.yaml
```

この時表示される`kubeadm join`コマンドはworkerノード構築で使うのでメモしておきます。

#### Podネットワークアドオンのインストール

kubernetesはCNIによってPodのネットワークを構築します。

また、kubernetesはこれらの機能をプラグインとして管理しているので、別途CNIに対応したソフトウェアをインストールする必要があります。
対応しているプラグインは[こちら](https://kubernetes.io/docs/concepts/cluster-administration/networking/)に一覧があります。

今回はkubernetesのテストでも使われている[calico](https://projectcalico.docs.tigera.io/about/about-calico)をインストールして使っていきます。

```bash
$ curl https://projectcalico.docs.tigera.io/manifests/calico.yaml -O
```

ダウンロードしたファイルのkubernetesのバージョンをインストールしたものに置き換えておきます。今回は`1.23.5`です。

最後に下記のコマンドでcalicoをkubernetesにデプロイします。

```bash
$ kubectl apply -f calio.yaml
```

### workerノードを構築する

`kubeadm init`実行時に表示されたjoin用のコマンドをワーカーノードで実行する。

コマンドのトークンの有効期限が1日なので１日以上間が空いてしまった場合はmasterノードで`kubeadm token create --print-join-command`を実行して再度トークンを発行してください。

```bash
$ kubeadm join 192.168.11.249:6443 --token baybl2.i0v3dragpuzikk9k \
        --discovery-token-ca-cert-hash sha256:784e7315d642b4feba182b8422d1d48fac3cba2cad5356481ddd3829eacce643
```

### 確認

ワーカーノードをマスターノードに参加させると、マスターノードで以下のコマンドを実行することでクラスタに参加しているノードを確認することができます。

```bash
NAME           STATUS   ROLES                  AGE     VERSION
k8s-master01   Ready    control-plane,master   2d11h   v1.23.5
k8s-worker01   Ready    <none>                 2d11h   v1.23.5
k8s-worker02   Ready    <none>                 4h3m    v1.23.5
k8s-worker03   Ready    <none>                 4h3m    v1.23.5
```

ワーカーノードがクラスタに参加できているので、想定通り１台のマスターノード、3台のワーカーノードの状態になっています。

あとはここにいろいろなアプリケーションをデプロイしてきたいですが、そちらの手順は別の記事にしたいと思います。（まだそこまでできてないだけ...）


## 参考資料

- https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/install-kubeadm/
- https://kubernetes.io/docs/setup/production-environment/container-runtimes/
- https://kubernetes.io/docs/tasks/administer-cluster/kubeadm/configure-cgroup-driver/
- https://kubernetes.io/ja/docs/setup/production-environment/tools/kubeadm/create-cluster-kubeadm/
- https://kubernetes.io/ja/docs/tasks/run-application/run-stateless-application-deployment/
- https://projectcalico.docs.tigera.io/getting-started/kubernetes/self-managed-onprem/onpremises

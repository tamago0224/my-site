---
layout: ../../layouts/MarkdownPostLayout.astro
title: "MetalLBを自宅k8sにインストールする"
pubDate: 2022-07-27
description: "今回は作成したk8sにMetalLBをインストールしていきます。"
author: "tamago0224"
image:
  url: https://docs.astro.build/assets/full-logo-light.png
  alt: Astroのロゴ
tags: ["kubernetes", "memo"]

---
# MetalLBを自宅k8sにインストールする

## 概要

今回は、前回の記事で構築した自宅k8sに[MetalLB](https://metallb.universe.tf/)をインストールしていきます。

## 目的

k8sにデプロイしたコンテナを外部からの疎通を持たせられる環境を用意していきます。

k8sではPodをデプロイしただけでは、Pod内のコンテナはPod外との通信を行うことはできないので、Serviceを別途定義することで、Pod内のコンテナを外部との通信を可能にさせることができます。

また、Serviceにはいくつかタイプがあり、デフォルトの場合は`ClusterIP`が割り当てられます。これは、k8sのクラスタ内でのみ通信が可能になるもので、k8sのクラスタ外との通信はできません。例えばk8sにServiceを定義してデプロイしたコンテナは`ClusterIP`の場合、クラスタ外のPCからは疎通がないということです。

クラスタ内のPodに対して疎通を持たせたい場合、Serviceオブジェクトの`Nodeport`または`LoadBalancer`を使うことで通信が可能になります。
`NodePort`は、k8sのノードのIPとポートを通してコンテナを公開します。このタイプではポート番号がノードのホストのポート番号を使うので、基本的には30000-32767の範囲でポートをマニフェストに記載します。
続いて`LoadBalancer`ですが、こちらは対象のコンテナへの疎通が可能なIPアドレスが払いだされ、コンテナとの通信が可能になるものです。

公開方法としてはどちらでもいいのですが、今回はServiceごとにIPを払い出しポート番号などを柔軟に指定できる`LoadBalancer`を使ってコンテナを公開できる環境を自宅k8s環境に用意していきます。
    
## MetalLBとは

Serviceの`LoadBalancer`を提供するためのロードバランサの実装です。

詳しくは[公式サイト](https://metallb.universe.tf/)をご覧ください。

また、[こちらの記事](https://blog.framinal.life/entry/2020/04/16/022042#MetalLB%E3%81%A8%E3%81%AF)も概要を掴むためにかなり力になりました。

## 環境

環境は[前回のk8s構築の記事](https://tamago0224.hatenablog.com/entry/2022/03/19/203356)をご覧ください。この時点から更新はしていません。

## インストール

公式サイトの手順通り進めていきます。

まずはkube-proxyのIPVS機能を使っている場合は`strict APR`モードを以下のコマンドで有効にする必要があります。

```bash
# see what changes would be made, returns nonzero returncode if different
$ kubectl get configmap kube-proxy -n kube-system -o yaml | \
sed -e "s/strictARP: false/strictARP: true/" | \
kubectl diff -f - -n kube-system

# actually apply the changes, returns nonzero returncode on errors only
$ kubectl get configmap kube-proxy -n kube-system -o yaml | \
sed -e "s/strictARP: false/strictARP: true/" | \
kubectl apply -f - -n kube-system
```

それでは実際にMetalLBをk8sのクラスタにデプロイしていきます。公式の手順ではKustomizeやHelmなどでの導入もあるので、お好きな方法で実施してください。
今回はmanifestを使用して行きます。

以下のコマンドでデプロイします。

```bash
$ kubectl apply -f https://raw.githubusercontent.com/metallb/metallb/v0.13.4/config/manifests/metallb-native.yaml
```

これでMetalLBのインストールは完了です。

## 設定

インストールは前述の手順で完了ですが、このままではServiceの`type`に`LoadBalancer`を指定してもIPの払い出しなどを行ってくれないので、以下のマニフェストを用意し、IPの払い出しができるように設定を投入していきます。

最初にMetalLBが払いだすIPアドレスのレンジを登録していきます。このIPアドレスはクライアントとの疎通があるIPアドレスである必要があります。
今回はk8sクラスタのホストが192.168.11.0/24にいるので、MetalLBが払いだすIPアドレスもこの範囲のものにします。
登録用のマニフェストは以下の通りです。

```yaml
apiVersion: metallb.io/v1beta1
kind: IPAddressPool
metadata:
  namespace: metallb-system
  name: simple-config
spec:
  addresses:
  - 192.168.11.100-192.168.11.239
```

`kind`が見慣れぬものですが、これはMetalLBのCRです。MetalLBでは0.12までは`ConfigMap`を経由した設定方法でしたが、今回インストールした`0.13.0`からMetalLBの設定は各種CRによって代替されるようになりました。

続いて、MetalLBが登録されたIPアドレスをどのようにServiceと紐づけユーザに提供していくのかを決定する方法を決めていきます。
今回はARPによるIPアドレスの解決を行い、MetalLBによって付与したIPアドレスにServiceを紐づける形式で環境を用意していきたいと思います。

```yaml
apiVersion: metallb.io/v1beta1
kind: L2Advertisement
metadata:
  name: layer2-config
  namespace: metallb-system
spec:
  ipAddressPools:
    - simple-config
```

これで設定は完了です。

## 実際に試してみる

テスト用のマニフェストを用意し、`type: LoadBalancer`でデプロイし、IPアドレスが想定通り割り当てられ疎通があるかテストしていきます。

テスト用のマニフェストは以下の通りです。

```yaml
kind: Service
metadata:
  name: service-load-balancer-nginx
  namespace: tamago
spec:
  selector:
    app: deployment-nginx
  type: LoadBalancer
  ports:
    - protocol: TCP
      port: 8080
      targetPort: 80
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: deployment-nginx-lb
  namespace: tamago
spec:
  replicas: 1
  selector:
    matchLabels:
      app: deployment-nginx
  template:
    metadata:
      labels:
        app: deployment-nginx
    spec:
      containers:
        - name: nginx-lb
          image: nginx:1.23
          ports:
            - containerPort: 80
```

シンプルなnginxを公開するためのものです。

以下のコマンドででプロしていきます。

```bash
$ kubectl apply -f service-sample-with-loadbalancer.yaml
```

確認してみます。

```bash
$ kubectl get -n tamago svc
NAME                          TYPE           CLUSTER-IP     EXTERNAL-IP      PORT(S)          AGE
service-load-balancer-nginx   LoadBalancer   10.101.137.8   192.168.11.100   8080:31560/TCP   4d1h
```

デプロイできてそうですね。EXTERNAL-IPに先ほど指定したIPアドレスの範囲内で割り当てられていることが確認できます。
実際にcurlでアクセスして応答が返ってくるか見てみます。

```bash
$ curl http://192.168.11.100:8080
<!DOCTYPE html>
<html>
<head>
<title>Welcome to nginx!</title>
<style>
html { color-scheme: light dark; }
body { width: 35em; margin: 0 auto;
font-family: Tahoma, Verdana, Arial, sans-serif; }
</style>
</head>
<body>
<h1>Welcome to nginx!</h1>
<p>If you see this page, the nginx web server is successfully installed and
working. Further configuration is required.</p>

<p>For online documentation and support please refer to
<a href="http://nginx.org/">nginx.org</a>.<br/>
Commercial support is available at
<a href="http://nginx.com/">nginx.com</a>.</p>

<p><em>Thank you for using nginx.</em></p>
</body>
</html>
```

よさげですね。

## 参考文献

- <https://metallb.universe.tf/>
- <https://blog.framinal.life/entry/2020/04/16/022042#MetalLB%E3%81%A8%E3%81%AF> 
- <https://metallb.universe.tf/#backward-compatibility>
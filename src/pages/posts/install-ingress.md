---
layout: ../../layouts/MarkdownPostLayout.astro
title: "自宅k8sにIngressをインストールする"
pubDate: 2022-08-21
description: "今回は自宅前回構築した自宅環境のk8sにIngressをインストールしていきます"
author: "taamgo0224"
image:
  url: https://docs.astro.build/assets/full-logo-light.png
  alt: Astroのロゴ
tags: ["kubernetes", "memo"]
---

## はじめに

今回は、自宅 k8s に Ingress 環境を用意していきます。

[前回](https://tamago0224.hatenablog.com/entry/2022/07/27/231926)、MetalLB のインストールを行ったため、サービスの外部公開自体はできていますが、HTTPなどのサービスをデプロイするたびにIPアドレスが変わるのは手間がかかりそうなので、Ingress でそのあたりを単一のエンドポイントに固定して行きたいと思います。

## Ingress とは

Ingress はクラスター外からのHTTP/HTTPSの通信をServiceのLoadBalancerで受け付け、通信を制御します。

Ingress を使うには Ingress コントローラのデプロイが別途必要なため、今回はその実装である[ingress-nginx](https://kubernetes.github.io/ingress-nginx/)を使って実現していきます。

## 手順

流れとしては ingress-nginx の [Install Guide](https://kubernetes.github.io/ingress-nginx/deploy/)をもとに進めていきます。

まずは `kubectl apply`でインストールするため、以下のコマンドで ingress-nginx をデプロイします。

```bash
$ kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.3.0/deploy/static/provider/cloud/deploy.yaml
```

実行後、下記コマンドで igress-nginx 関連の Pod が正常に動作完了しているか確認します。
もし正常に完了すれば、下記のような結果になるはずです。

```bash
$ kubectl wait --namespace ingress-nginx \
     --for=condition=ready pod \
     --selector=app.kubernetes.io/component=controller \
     --timeout=120s
pod/ingress-nginx-controller-54d587fbc6-lk6zm condition met
```

テストのため、デモ用の Pod と Ingress を用意します。

今回、自宅 k8s には MetalLB を入れて、Service の LoadBalancer をサポートしているため、「Online testing」の手順で動作確認します。

```bash
$ kubectl create deployment demo --image=httpd --port=80
$ kubectl expose deployment demo
$ kubectl create ingress demo-localhost --class=nginx \
  --rule="demo.example.com/*=demo:80"
```

`--rule`オプションでホストを指定する場合、DNS形式での指定が条件となるので、`demo.example.com`を指定しました。

IPアドレスは、下記コマンドで出力される`EXTERNAL-IP`の項目で表示されているIPアドレスです。

```bash
$ kubectl get service ingress-nginx-controller --namespace=ingress-nginx
```

`demo.example.com`は適当に指定した名前なので、こちらのDNSを先ほどのIPアドレスで解決できるように、適宜 `/etc/hosts` を編集するなりで名前解決できるようにします。

この状態でブラウザから`http://demo.example.com/`にアクセスすると「It Works!」と表示されれば正常に Ingress のセットアップは完了です。

## まとめ

## 参考資料

- <https://kubernetes.github.io/ingress-nginx/deploy/>
- <https://kubernetes.github.io/ingress-nginx/deploy/baremetal/>

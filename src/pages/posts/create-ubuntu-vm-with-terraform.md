---
layout: ../../layouts/MarkdownPostLayout.astro
title: "Terraformを使ってUbuntu 20.04上にVMを作成する"
pubDate: 2022-03-08
description: "前回作成したKVM基盤にterraformを使ってVMを作成していきます"
author: "taamgo0224"
image:
  url: https://docs.astro.build/assets/full-logo-light.png
  alt: Astroのロゴ
tags: ["ubuntu", "tarraform", "memo"]
---
# Terraformを使ってUbuntu 20.04上にVMを作成する

## 概要

[前回の記事](https://tamago0224.hatenadiary.jp/entry/2022/02/13/170446)ではUbuntu 20.04にKVMをインストールし、virt-installコマンドでVMを作成するところまで行いました。

しかし、VMの構築を都度virt-installコマンドで実施するのは面倒なため、今回の内容でterraformのlibvirt providerである [dmacvicar/terraform-provider-libvirt](https://github.com/dmacvicar/terraform-provider-libvirt)を使ってVMの構築をできるようにします。

なお、terraformについての説明などは省くので、ご了承ください。

## terraformをインストールする

バージョン管理が面倒なので、[asdf](https://github.com/asdf-vm/asdf)を使ってterraformをインストールしてterraformのバージョン管理を手軽に行えるようにしておく。

```bash
$ sudo apt install curl git
$ git clone https://github.com/asdf-vm/asdf.git ~/.asdf --branch v0.9.0 # branchは適宜最新のものを指定してください。
# 下記の内容を .bashrc に追加します。
echo '. $HOME/.asdf/asdf.sh' >> ~/.bashrc
echo '. $HOME/.asdf/completions/asdf.bash' >> ~/.bashrc
$ asdf --version
v0.9.0-9ee24a3
$ asdf plugin-list-all # インストール可能なプラグインのリストを確認できる
$ asdf plugin add terraform
$ asdf install terraform latest # とりあえず最新を入れる
$ asdf global terraform 1.1.5
$ terraofmr version
Terraform v1.1.5
on linux_amd64
```

## terraformでvmを作成するための下準備

もし、pool関連でファイル権限エラーが出た場合は、以下のURLの対応を試してみてください。

- <https://github.com/dmacvicar/terraform-provider-libvirt/issues/546#issuecomment-840127487>

## dmacvicar/terraform-provider-libvirt を使って Ubuntu 20.04 のVMを作成する

terraformの`libvirt-provider`を通してKVM上にVMを作成し、コンソール接続でVMにログインするまで実施します。

プロジェクト用のディレクトリを作成します。

```bash
$ mkdir -p ~/project/terraform-libvirt-proj && cd ~/project/terraform-libvirt-proj
```
terraformのファイルを用意します。ファイル名は`main.tf`とします。各リソースの詳細は`libvirt-provider`の[ドキュメント](https://registry.terraform.io/providers/dmacvicar/libvirt/latest/docs)を参照してください。

```terraform
terraform {
  required_version = "~> 1.1.0"
  required_providers {
      libvirt = {
          source = "dmacvicar/libvirt"
          version = "0.6.14"
      }
  }
}

provider "libvirt" {
    uri = "qemu:///system"
}

resource "libvirt_volume" "ubuntu-qcow2" {
    name = "ubuntu-qcow2"
    source = "https://cloud-images.ubuntu.com/focal/current/focal-server-cloudimg-amd64.img"
    format = "qcow2"
}

resource "libvirt_volume" "ubuntu-node" {
    name = "ubuntu-base"
    base_volume_id = libvirt_volume.ubuntu-qcow2.id
    size = 536870912000
}

data "template_file" "user_data" {
    template = file("${path.module}/cloud_init.cfg")
}

resource "libvirt_cloudinit_disk" "commoninit" {
    name = "common.iso"
    user_data = data.template_file.user_data.rendered
}

resource "libvirt_domain" "k8s-node" {
    name = "worker01"
    memory = "8096"
    vcpu = 4

    cloudinit = libvirt_cloudinit_disk.commoninit.id

    network_interface {
        bridge = "br0"
    }

    console {
        type = "pty"
        target_port = "0"
        target_type = "serial"
    }

    console {
        type = "pty"
        target_type = "virtio"
        target_port = "1"
    }

    disk {
        volume_id = libvirt_volume.ubuntu-node.id
    }

    graphics {
        type = "spice"
        listen_type = "address"
        autoport = true

    }
}
```

続いて、こちらのファイルは[cloud-init](https://cloudinit.readthedocs.io/en/latest/)と呼ばれるクラウドサービスなどでOS起動時に各種設定を自動で行えるようにする仕組みです。今回はこの仕組みを使ってログイン時のユーザ設定を行います。

まず、`cloud_init.cfg`ファイルを用意します。\<username\>および\<password\>は適宜お好みの文字列に置き換えてください。

```yaml
#cloud-config
system_info:
  default_user:
    name: <username>
    home: /home/<username>
password: <password>
chpasswd: { expire: False }
hostname: local

# configure sshd to allow users logging in using password
# rather than just keys
ssh_pwauth: True
```

下記コマンドでterraformプロジェクトを初期化します

```bash
$ terraform init
```

上記コマンド実行後、作成したファイルの構成情報をもとにVMを作成していきます。

```bash
$ terraform apply -auto-approve
```

正常に完了すると、VMが作成されていることが確認できます。

```bash
$ virsh list --all
 Id   Name       State
--------------------------
1    worker01   running

$ virsh console worker01
```

## ネットワークの設定を行う

VMの作成まできるようになりましたが、ホストのネットワーク設定についてはまだ何も行われていません。
実際に、ホストで `ip address`コマンドでホストのIPアドレス情報を表示してもアドレスが割り当てられていることは確認できません。

前の章で`main.tf`に記載した`libvirt_cloudinit_disk`リソースに`network_config`パラメータがあるので、こちらに作成するネットワーク設定のcloud-init設定ファイルを指定します。

設定ファイルを修正する前に、一度VMを削除しておきましょう。

```bash
$ terraform destroy -auto-approve
```

では、`network_config.cfg`ファイルを作成し、下記の内容で保存しましょう。IPアドレスなどはお使いの環境に併せて適宜修正してください。

```yaml
version: 2
ethernets:
  ens3:
    dhcp4: false
    addresses:
      - 192.168.11.249/24
    gateway4: 192.168.11.1
    nameservers:
      addresses: [192.168.11.1, 8.8.8.8]
```

続いて、`main.tf`の内容を修正します。ネットワーク設定用の`template_file`と`libvirt_cloudinit_disk`で`network_config`が指定されています。

```text
terraform {
  required_version = "~> 1.1.0"
  required_providers {
      libvirt = {
          source = "dmacvicar/libvirt"
          version = "0.6.14"
      }
  }
}

provider "libvirt" {
    uri = "qemu:///system"
}

resource "libvirt_volume" "ubuntu-qcow2" {
    name = "ubuntu-qcow2"
    source = "https://cloud-images.ubuntu.com/focal/current/focal-server-cloudimg-amd64.img"
    format = "qcow2"
}

resource "libvirt_volume" "ubuntu-node" {
    name = "ubuntu-base"
    base_volume_id = libvirt_volume.ubuntu-qcow2.id
    size = 536870912000
}

data "template_file" "user_data" {
    template = file("${path.module}/cloud_init.cfg")
}

data "template_file" "network_config" {
    template = file("${path.module}/network_config.cfg")
}

resource "libvirt_cloudinit_disk" "commoninit" {
    name = "common.iso"
    user_data = data.template_file.user_data.rendered
    network_config = data.template_file.network_config.rendered
}

resource "libvirt_domain" "k8s-node" {
    name = "worker01"
    memory = "8096"
    vcpu = 4

    cloudinit = libvirt_cloudinit_disk.commoninit.id

    network_interface {
        bridge = "br0"
    }

    console {
        type = "pty"
        target_port = "0"
        target_type = "serial"
    }

    console {
        type = "pty"
        target_type = "virtio"
        target_port = "1"
    }

    disk {
        volume_id = libvirt_volume.ubuntu-node.id
    }

    graphics {
        type = "spice"
        listen_type = "address"
        autoport = true

    }
}
```

設定ファイルを修正し終わったら前回同様に`terraform apply`コマンドを使ってVMを作成しましょう。

```bash
$ terraform apply -auto-approve
```

ログイン後、`ip address`コマンドでネットワークインターフェースの割り当てを確認すると、`network_config.cfg`ファイルで指定したIPアドレスが割り当てられていることが確認できると思います。


## 参考資料

- terraformをインストールする:
  - <http://asdf-vm.com/guide/getting-started.html#_1-install-dependencies>
- dmacvicar/terraform-provider-libvirt を使って Ubuntu 20.04 のVMを作成する:
  - <https://endy-tech.hatenablog.jp/entry/kvm_setup_and_libvirt_cli#pool-%E4%BD%9C%E6%88%90%E3%81%AE%E4%BA%8B%E5%89%8D%E6%BA%96%E5%82%99>
  - <https://github.com/dmacvicar/terraform-provider-libvirt/tree/main/examples/v0.13/ubuntu>
- ネットワーク設定を行う
  - <https://github.com/dmacvicar/terraform-provider-libvirt/tree/main/examples/v0.13/ubuntu>


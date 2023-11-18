---
layout: ../../layouts/MarkdownPostLayout.astro
title: "Ubuntu 20.04にKVMをインストールする"
pubDate: 2022-03-08
description: "Ubuntu 20.04にKVMをインストールして仮想基盤を構築していきます"
author: "taamgo0224"
image:
  url: https://docs.astro.build/assets/full-logo-light.png
  alt: Astroのロゴ
tags: ["ubuntu", "kvm", "memo"]
---
# Ubuntu 20.04にKVMをインストールする

## 概要

Ubuntu 20.04 にKVMでVMを作成できる環境を用意する。

また、VMは外部からアクセスできるようになっていること。

## 手順

### KVMの設定

1. CPUが仮想化をサポートしているか確認する

   ```bash
   $ egrep -c '(vmx|svm)' /proc/cpuinfo
   1以上の数字が表示されること
   ```
   1. kvm-okでも代用可能

        ```bash
        $ kvm-ok
        INFO: /dev/kvm exists
        KVM acceleration can be used
        ```
2. kernelが64bit対応稼働確認する。x86_64が出力されればよい

   ```bash
   $ uname -m
   x86_64
   ```
3. KVMに必要なパッケージをインストールする

   ```bash
   $ sudo apt install qemu-kvm libvirt-daemon-system libvirt-cl$]ients bridge-utils virtinst

   ```

   - libvirt-bin provides libvirtd which you need to administer qemu and kvm instances using libvirt
   - qemu-kvm (kvm in Karmic and earlier) is the backend
   - ubuntu-vm-builder powerful command line tool for building virtual machines
   - bridge-utils provides a bridge from your network to the virtual machines
4. ユーザを kvm/libvirt グループに追加する。下記コマンド実行後、再ログインを行うこと

    ```bash
    $ sudo adduser `id -un` libvirt
    Adding user '<username>' to group 'libvirt' ...
    $ sudo adduser `id -un` kvm
    Adding user '<username>' to group 'kvm' ...
    ```
5. kvmがインストールできたことを確認する

    ```bash
    $ virsh list --all
     Id   Name   State
    --------------------

    ```

### KVMのネットワーク設定

外部からのネットワーク通信を、ホストの物理インターフェースを通してVMにアクセスさせるためにbridgeネットワークを設定していきます。

1. デフォルトで作成されたvirbr0を削除する

   ```bash
   $ sudo virsh net-autostart default --disable
   $ sudo virsh net-destroy default
   ```
2. netplanでbr0を作成する

    ```bash
    $ cat /etc/netplan/00-installer-config.yaml
    # This is the network config written by 'subiquity'
    network:
      ethernets:
        enp8s0:
          dhcp4: false
          dhcp6: false
    version: 2
    bridges:
      br0:
        interfaces: [enp8s0]
        addresses: [192.168.11.250/24]
        gateway4: 192.168.11.1
        nameservers:
          addresses: [192.168.11.1, 8.8.8.8]
    $ sudo netplan apply
    ```

### KVMでVMの作成

cloud imageのUbuntu20.04を使ってKVMにUbuntu 20.04VMを作成する。

1. ubuntu 20.04 の cloud image をダウンロードする

    ```bash
    wget https://cloud-images.ubuntu.com/focal/20220208/focal-server-cloudimg-amd64.img
    ```
2. cloud initのイメージ作成用のツールをインストールする
3. ダウンロードしたイメージファイルをqcow2形式に変換する

   ```bash
   $ qemu-img convert -f qcow2 -O qcow2 ./focal-server-cloudimg-amd64.img ./root-disk.qcow2
   ```
4. qcow2のディスクサイズを20GBにリサイズする（何GBでもいい）

    ```bash
    $ qemu-img resize ./root-disk.qcow2 20G
    ```
6. cloud initを使って、ユーザ定義を設定する

    ```bash
    $ cat << EOF > cloud-init.cfg
    #cloud-config
    system_info:
      default_user:
        name: $USERNAME
        home: /home/$USERNAME

    password: $PASSWORD
    chpasswd: { expire: False }
    hostname: $VM_NAME

    # configure sshd to allow users logging in using password 
    # rather than just keys
    ssh_pwauth: True
    EOF
    $ cat << EOF > network-config.cfg
    version: 2
    ethernets:
    ens3:
      dhcp4: false
      addresses:
        - 192.168.11.249/24
      gateway4: 192.168.11.1
      nameservers:
        addresses: [192.168.11.1, 8.8.8.8]
    EOF
    ```
7. cloud-init.cfgをもとに、ブート時に読み込ませるディスクを作成する

   ```bash
   $ cloud-localds --network-config=./network-config.cfg ./cloud-init.iso cloud-init.cfg
   ```
8. virt-installコマンドでVMを作成する

    ```bash
    $ sudo virt-install \
    --name "ubuntu-sample" \
    --memory 1024 \
    --disk ./root-disk.qcow2,device=disk,bus=virtio \
    --disk ./cloud-init.iso,device=cdrom \
    --os-type linux \
    --os-variant ubuntu20.04 \
    --virt-type kvm \
    --graphics none \
    --network bridge:br0 \
    --import
    ```
9. VMが作成されたことを確認する

    ```bash
    $ virsh list --all
     Id   Name            State
    -------------------------------
     1    ubuntu-sample   running
    ```
10. VMにログインする。ログイン情報はcloud-init.cfg定義したユーザ情報

    ```bash
    $ virsh console ubuntu-sample
    ```

### 参考資料

- KVM設定: <https://help.ubuntu.com/community/KVM/Installation>
- KVMのネットワーク設定:
  - <https://symfoware.blog.fc2.com/blog-entry-2446.html>
  - <https://www.linuxtechi.com/install-kvm-on-ubuntu-20-04-lts-server/>
- KVMでVMの作成:
  - <https://blog.programster.org/create-ubuntu-20-kvm-guest-from-cloud-image>
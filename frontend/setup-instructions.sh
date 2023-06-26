git clone --depth 1 git@github.com:flatpak/flatpak.github.io.git

cp flatpak.github.io/data/distro.yml src/data/distro.yml
cp -r flatpak.github.io/source/img/distro public/img

rm -rf flatpak.github.io
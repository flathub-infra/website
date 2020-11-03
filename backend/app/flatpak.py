import subprocess


def initialize():
    remote_add_cmd = [
        "flatpak",
        "--user",
        "remote-add",
        "--if-not-exists",
        "flathub",
        "https://flathub.org/repo/flathub.flatpakrepo",
    ]
    subprocess.run(remote_add_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

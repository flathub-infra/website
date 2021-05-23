import subprocess


class Flatpak:
    def __init__(self):
        self.run_command(
            "remote-add",
            "--if-not-exists",
            "flathub",
            "https://flathub.org/repo/flathub.flatpakrepo",
        )
        self.remote_info("org.freedesktop.Platform//20.08")

    def run_command(self, *args):
        base_command = ["flatpak", "--user"]

        args = list(args)
        command = base_command + args

        ret = subprocess.run(command, stdout=subprocess.PIPE)
        if ret.returncode != 0:
            return None

        return ret.stdout.decode("utf-8")

    def remote_info(self, appid, cached=False):
        command = ["remote-info", "--user", "flathub", appid]
        if cached:
            command.append("--cached")

        output = self.run_command(*command)
        if output:
            output = output.replace("\xa0", " ")

            info = {}
            for line in output.split("\n"):
                if ": " in line:
                    key, value = line.split(": ", 1)
                    info[key.lstrip()] = value.rstrip()

            return info
        else:
            return None

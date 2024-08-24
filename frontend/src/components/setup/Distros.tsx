export const distroMap = new Map<string, JSX.Element>()
import { HowToJsonLd } from "next-seo"
import CodeCopy from "src/components/application/CodeCopy"
export const Ubuntu = () => (
  <ol className="distrotut">
    <HowToJsonLd
      name="Ubuntu"
      image="https://flathub.org/img/distro/ubuntu.svg"
      estimatedCost={{ currency: "USD", value: "0" }}
      step={[
        {
          url: "https://flathub.org/setup/ubuntu",
          name: "Install Flatpak",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "To install Flatpak on Ubuntu 18.10 (Cosmic Cuttlefish) or later, simply run: sudo apt install flatpak With older Ubuntu versions, the official Flatpak PPA is the recommended way to install Flatpak. To install it, run the following in a terminal: sudo add-apt-repository ppa:flatpak/stable sudo apt update sudo apt install flatpak",
            },
          ],
        },
        {
          url: "https://flathub.org/setup/ubuntu",
          name: "Install the Software Flatpak plugin",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "The Flatpak plugin for the Software app makes it possible to install apps without needing the command line. To install, run: sudo apt install gnome-software-plugin-flatpak Note: the Software app is distributed as a Snap since Ubuntu 20.04 and does not support graphical installation of Flatpak apps. Installing the Flatpak plugin will also install a deb version of Software and result in two Software apps being installed at the same time.",
            },
          ],
        },
        {
          url: "https://flathub.org/setup/ubuntu",
          name: "Add the Flathub repository",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "Flathub is the best place to get Flatpak apps. To enable it, run: flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo",
            },
          ],
        },
        {
          url: "https://flathub.org/setup/ubuntu",
          name: "Restart",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "To complete setup, restart your system. Now all you have to do is install some apps!",
            },
          ],
        },
      ]}
    />

    <li>
      <h2>Install Flatpak</h2>
      <p>
        To install Flatpak on Ubuntu 18.10 (Cosmic Cuttlefish) or later, simply
        run:
      </p>{" "}
      <CodeCopy text={`sudo apt install flatpak`} />{" "}
      <p>
        With older Ubuntu versions, the official Flatpak PPA is the recommended
        way to install Flatpak. To install it, run the following in a terminal:
      </p>{" "}
      <CodeCopy
        text={` sudo add-apt-repository ppa:flatpak/stable
 sudo apt update
 sudo apt install flatpak
 `}
      />
    </li>

    <li>
      <h2>Install the Software Flatpak plugin</h2>
      <p>
        The Flatpak plugin for the Software app makes it possible to install
        apps without needing the command line. To install, run:
      </p>{" "}
      <CodeCopy text={`sudo apt install gnome-software-plugin-flatpak`} />{" "}
      <p>
        Note: the Software app is distributed as a Snap since Ubuntu 20.04 and
        does not support graphical installation of Flatpak apps. Installing the
        Flatpak plugin will also install a deb version of Software and result in
        two Software apps being installed at the same time.
      </p>
    </li>

    <li>
      <h2>Add the Flathub repository</h2>
      <p>
        Flathub is the best place to get Flatpak apps. To enable it, run:
      </p>{" "}
      <CodeCopy
        text={`flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo`}
      />
    </li>

    <li>
      <h2>Restart</h2>
      <p>
        To complete setup, restart your system. Now all you have to do is{" "}
        <a href="https://flathub.org/">install some apps</a>!
      </p>
    </li>
  </ol>
)
distroMap.set("Ubuntu", <Ubuntu />)

export const Fedora = () => (
  <ol className="distrotut">
    <p>
      Flatpak is installed by default on Fedora Workstation, Fedora Silverblue,
      and Fedora Kinoite. To get started, all you need to do is enable Flathub,
      which is the best way to get Flatpak apps. Flathub is pre-configured as a
      part of the{" "}
      <a href="https://docs.fedoraproject.org/en-US/workstation-working-group/third-party-repos/">
        Third-Party Repositories
      </a>
      . Alternatively, you can download and install the{" "}
      <a
        className="btn btn-default"
        href="https://dl.flathub.org/repo/flathub.flatpakrepo"
      >
        Flathub repository file
      </a>
      .
    </p>{" "}
    <p>
      Now all you have to do is{" "}
      <a href="https://flathub.org/">install some apps</a>!
    </p>{" "}
    <p>
      The above links should work on the default GNOME and KDE Fedora
      installations, but if they fail for some reason you can manually add the
      Flathub remote by running:
    </p>{" "}
    <CodeCopy
      text={`flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo`}
    />
  </ol>
)
distroMap.set("Fedora", <Fedora />)

export const Manjaro = () => (
  <ol className="distrotut">
    <HowToJsonLd
      name="Manjaro"
      image="https://flathub.org/img/distro/manjaro.svg"
      estimatedCost={{ currency: "USD", value: "0" }}
      step={[
        {
          url: "https://flathub.org/setup/manjaro",
          name: "Enable Flatpak through the Software Manager",
          itemListElement: [
            {
              type: "HowToDirection",
              text: 'Flatpak is installed by default on Manjaro 20 or higher. To enable its support, navigate to the Software Manager (Add/Remove Programs) Click on the triple line menu [or dots depending on the Desktop Environment] on the right, in the drop down menu select "Preferences" Navigate to the "Flatpak" tab and slide the toggle to Enable Flatpak support (it is also possible to enable checking for updates, which is recommended).',
            },
          ],
        },
        {
          url: "https://flathub.org/setup/manjaro",
          name: "Restart",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "To complete setup, restart your system. Now all you have to do is install some apps!",
            },
          ],
        },
      ]}
    />

    <li>
      <h2>Enable Flatpak through the Software Manager</h2>
      <p>Flatpak is installed by default on Manjaro 20 or higher.</p>{" "}
      <p>
        To enable its support, navigate to the <strong>Software Manager</strong>{" "}
        (Add/Remove Programs)
      </p>{" "}
      <p>
        Click on the triple line menu [or dots depending on the Desktop
        Environment] on the right, in the drop down menu select "Preferences"
      </p>{" "}
      <p>
        Navigate to the "Flatpak" tab and slide the toggle to Enable Flatpak
        support (it is also possible to enable checking for updates, which is
        recommended).
      </p>
    </li>

    <li>
      <h2>Restart</h2>
      <p>
        To complete setup, restart your system. Now all you have to do is{" "}
        <a href="https://flathub.org/">install some apps</a>!
      </p>
    </li>
  </ol>
)
distroMap.set("Manjaro", <Manjaro />)

export const Endless_OS = () => (
  <ol className="distrotut">
    <h2>
      Flatpak support is built into Endless OS 3.0.0 and newer—no setup
      required!
    </h2>{" "}
    <p>
      If you are using an older version,{" "}
      <a href="https://community.endlessos.com/t/upgrade-from-endless-os-2-x-to-endless-os-3/967">
        upgrade to Endless OS 3
      </a>
      .
    </p>
  </ol>
)
distroMap.set("Endless OS", <Endless_OS />)

export const ALT_Linux = () => (
  <ol className="distrotut">
    <HowToJsonLd
      name="ALT Linux"
      image="https://flathub.org/img/distro/altlinux.svg"
      estimatedCost={{ currency: "USD", value: "0" }}
      step={[
        {
          url: "https://flathub.org/setup/alt_linux",
          name: "Install Flatpak",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "To install Flatpak on operating systems of the Alt family, simply run: su - apt-get update apt-get install flatpak",
            },
          ],
        },
        {
          url: "https://flathub.org/setup/alt_linux",
          name: "Add the Flathub repository",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "Flathub is a great place to get Flatpak apps. To enable it on your Alt system, run: su - apt-get update apt-get install flatpak-repo-flathub",
            },
          ],
        },
        {
          url: "https://flathub.org/setup/alt_linux",
          name: "Restart",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "Restart your device to complete the Flatpak installation. Now you can install some apps!",
            },
          ],
        },
      ]}
    />

    <li>
      <h2>Install Flatpak</h2>
      <p>
        To install Flatpak on operating systems of the Alt family, simply run:
      </p>{" "}
      <CodeCopy
        text={` su -
 apt-get update
 apt-get install flatpak
 `}
      />
    </li>

    <li>
      <h2>Add the Flathub repository</h2>
      <p>
        Flathub is a great place to get Flatpak apps. To enable it on your Alt
        system, run:
      </p>{" "}
      <CodeCopy
        text={` su -
 apt-get update
 apt-get install flatpak-repo-flathub
 `}
      />
    </li>

    <li>
      <h2>Restart</h2>
      <p>
        Restart your device to complete the Flatpak installation. Now you can{" "}
        <a href="https://flathub.org/">install some apps</a>!
      </p>
    </li>
  </ol>
)
distroMap.set("ALT Linux", <ALT_Linux />)

export const Chrome_OS = () => (
  <ol className="distrotut">
    <HowToJsonLd
      name="Chrome OS"
      image="https://flathub.org/img/distro/chrome-os.svg"
      estimatedCost={{ currency: "USD", value: "0" }}
      step={[
        {
          url: "https://flathub.org/setup/chrome_os",
          name: "Enable Linux support",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "Navigate to chrome://os-settings, and scroll down to Developers and turn on Linux development environment. ChromeOS will take some time downloading and installing Linux.",
            },
          ],
        },
        {
          url: "https://flathub.org/setup/chrome_os",
          name: "Start a Linux terminal",
          itemListElement: [
            {
              type: "HowToDirection",
              text: 'Press the Search/Launcher key, type "Terminal", and launch the Terminal app.',
            },
          ],
        },
        {
          url: "https://flathub.org/setup/chrome_os",
          name: "Install Flatpak",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "To install Flatpak, run the following in the terminal: sudo apt install flatpak A more up to date flatpak package is available in the Debian backports repository.",
            },
          ],
        },
        {
          url: "https://flathub.org/setup/chrome_os",
          name: "Add the Flathub repository",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "Flathub is the best place to get Flatpak apps. To enable it, run: flatpak --user remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo",
            },
          ],
        },
        {
          url: "https://flathub.org/setup/chrome_os",
          name: "Restart",
          itemListElement: [
            {
              type: "HowToDirection",
              text: 'To complete setup, restart Linux. You can do this by right-clicking terminal, and then clicking "Shut down Linux". Now all you have to do is install some apps!',
            },
          ],
        },
      ]}
    />
    <p>
      Flatpak applications can be installed on ChromeOS with the Crostini Linux
      compatibility layer. This is not available for all ChromeOS devices, so
      you should ensure your device is compatible before proceeding. A list of
      compatible devices is maintained{" "}
      <a href="https://www.reddit.com/r/Crostini/wiki/getstarted/crostini-enabled-devices">
        here
      </a>
      .
    </p>

    <li>
      <h2>Enable Linux support</h2>
      <p>
        Navigate to <a href="chrome://os-settings">chrome://os-settings</a>, and
        scroll down to <strong>Developers</strong> and turn on{" "}
        <i>Linux development environment</i>. ChromeOS will take some time
        downloading and installing Linux.
      </p>
    </li>

    <li>
      <h2>Start a Linux terminal</h2>
      <p>
        Press the Search/Launcher key, type "Terminal", and launch the Terminal
        app.
      </p>
    </li>

    <li>
      <h2>Install Flatpak</h2>
      <p>To install Flatpak, run the following in the terminal:</p>{" "}
      <CodeCopy text={`sudo apt install flatpak`} />{" "}
      <p>
        A more up to date flatpak package is available in the{" "}
        <a href="https://backports.debian.org/Instructions/">
          Debian backports repository
        </a>
        .{" "}
      </p>
    </li>

    <li>
      <h2>Add the Flathub repository</h2>
      <p>
        Flathub is the best place to get Flatpak apps. To enable it, run:
      </p>{" "}
      <CodeCopy
        text={`flatpak --user remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo`}
      />
    </li>

    <li>
      <h2>Restart</h2>
      <p>
        To complete setup, restart Linux. You can do this by right-clicking
        terminal, and then clicking "Shut down Linux". Now all you have to do is{" "}
        <a href="https://flathub.org/">install some apps</a>!
      </p>
    </li>
  </ol>
)
distroMap.set("Chrome OS", <Chrome_OS />)

export const Red_Hat_Enterprise_Linux = () => (
  <ol className="distrotut">
    <p>
      Flatpak is installed by default on Red Hat Enterprise Linux Workstation 9
      and newer. To get started, all you need to do is enable Flathub, which is
      the best way to get Flatpak apps. Just download and install the{" "}
      <a
        className="btn btn-default"
        href="https://dl.flathub.org/repo/flathub.flatpakrepo"
      >
        Flathub repository file
      </a>
      .
    </p>{" "}
    <p>
      To install Flatpak on Red Hat Enterprise Linux Workstation 8 or older, run
      the following in a terminal:
    </p>{" "}
    {/*  Apparently the GNOME Software Flatpak plugin is shipped as part of the GNOME Software package, so there’s no need to separately install it  */}{" "}
    <CodeCopy text={`sudo yum install flatpak`} />{" "}
    <p>
      Now all you have to do is{" "}
      <a href="https://flathub.org/">install some apps</a>!
    </p>{" "}
    <p>
      The above links should work on the default Red Hat Enterprise Linux
      Workstation 9 installation, but if they fail for some reason you can
      manually add the Flathub remote by running:
    </p>{" "}
    <CodeCopy
      text={`flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo`}
    />
  </ol>
)
distroMap.set("Red Hat Enterprise Linux", <Red_Hat_Enterprise_Linux />)

export const Linux_Mint = () => (
  <ol className="distrotut">
    <h2>
      Flatpak support is built into Linux Mint 18.3 and newer—no setup required!
    </h2>{" "}
    <p>
      If you are using an older version,{" "}
      <a href="https://blog.linuxmint.com/?p=3462">
        upgrade to Linux Mint 18.3
      </a>
      .
    </p>
  </ol>
)
distroMap.set("Linux Mint", <Linux_Mint />)

export const OpenSUSE = () => (
  <ol className="distrotut">
    <HowToJsonLd
      name="openSUSE"
      image="https://flathub.org/img/distro/opensuse.svg"
      estimatedCost={{ currency: "USD", value: "0" }}
      step={[
        {
          url: "https://flathub.org/setup/opensuse",
          name: "Install Flatpak",
          itemListElement: [
            {
              type: "HowToDirection",
              text: 'Flatpak is available in the default repositories of all currently maintained openSUSE Leap and openSUSE Tumbleweed versions. If you prefer a graphical installation, you can install Flatpak using a "1-click installer" from software.opensuse.org. If your distribution version is not shown by default, click Show flatpak for other distributions first and then select from the list. Alternatively, install Flatpak from the command line using Zypper: sudo zypper install flatpak',
            },
          ],
        },
        {
          url: "https://flathub.org/setup/opensuse",
          name: "Add the Flathub repository",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "Flathub is the best place to get Flatpak apps. To enable it, run: flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo",
            },
          ],
        },
        {
          url: "https://flathub.org/setup/opensuse",
          name: "Restart",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "To complete setup, restart your system. Now all you have to do is install some apps!",
            },
          ],
        },
      ]}
    />

    <li>
      <h2>Install Flatpak</h2>
      <p>
        Flatpak is available in the default repositories of all currently
        maintained openSUSE Leap and openSUSE Tumbleweed versions.
      </p>{" "}
      <p>
        If you prefer a graphical installation, you can install Flatpak using a
        "1-click installer" from{" "}
        <a href="https://software.opensuse.org/package/flatpak">
          software.opensuse.org
        </a>
        . If your distribution version is not shown by default, click{" "}
        <em>Show flatpak for other distributions</em> first and then select from
        the list.
      </p>{" "}
      <p>Alternatively, install Flatpak from the command line using Zypper:</p>{" "}
      <CodeCopy text={`sudo zypper install flatpak`} />
    </li>

    <li>
      <h2>Add the Flathub repository</h2>
      <p>
        Flathub is the best place to get Flatpak apps. To enable it, run:
      </p>{" "}
      <CodeCopy
        text={`flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo`}
      />
    </li>

    <li>
      <h2>Restart</h2>
      <p>
        To complete setup, restart your system. Now all you have to do is{" "}
        <a href="https://flathub.org/">install some apps</a>!
      </p>
    </li>
  </ol>
)
distroMap.set("openSUSE", <OpenSUSE />)

export const Arch = () => (
  <ol className="distrotut">
    <HowToJsonLd
      name="Arch"
      image="https://flathub.org/img/distro/arch.svg"
      estimatedCost={{ currency: "USD", value: "0" }}
      step={[
        {
          url: "https://flathub.org/setup/arch",
          name: "Install Flatpak",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "To install Flatpak on Arch, simply run: sudo pacman -S flatpak",
            },
          ],
        },
        {
          url: "https://flathub.org/setup/arch",
          name: "Restart",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "To complete setup, restart your system. Now all you have to do is install some apps!",
            },
          ],
        },
      ]}
    />

    <li>
      <h2>Install Flatpak</h2>
      <p>To install Flatpak on Arch, simply run:</p>{" "}
      <CodeCopy text={`sudo pacman -S flatpak`} />
    </li>

    <li>
      <h2>Restart</h2>
      <p>
        To complete setup, restart your system. Now all you have to do is{" "}
        <a href="https://flathub.org/">install some apps</a>!
      </p>
    </li>
  </ol>
)
distroMap.set("Arch", <Arch />)

export const Debian = () => (
  <ol className="distrotut">
    <HowToJsonLd
      name="Debian"
      image="https://flathub.org/img/distro/debian.svg"
      estimatedCost={{ currency: "USD", value: "0" }}
      step={[
        {
          url: "https://flathub.org/setup/debian",
          name: "Install Flatpak",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "A flatpak package is available in Debian 10 (Buster) and newer. To install it, run the following as root: sudo apt install flatpak",
            },
          ],
        },
        {
          url: "https://flathub.org/setup/debian",
          name: "Install the Software Flatpak plugin",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "If you are running GNOME, it is also a good idea to install the Flatpak plugin for GNOME Software. To do this, run: sudo apt install gnome-software-plugin-flatpak If you are running KDE, you should instead install the Plasma Discover Flatpak backend: sudo apt install plasma-discover-backend-flatpak",
            },
          ],
        },
        {
          url: "https://flathub.org/setup/debian",
          name: "Add the Flathub repository",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "Flathub is the best place to get Flatpak apps. To enable it, download and install the Flathub repository file or run the following in a terminal: flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo",
            },
          ],
        },
        {
          url: "https://flathub.org/setup/debian",
          name: "Restart",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "To complete setup, restart your system. Now all you have to do is install some apps!",
            },
          ],
        },
      ]}
    />

    <li>
      <h2>Install Flatpak</h2>
      <p>
        A flatpak package is available in Debian 10 (Buster) and newer. To
        install it, run the following as root:
      </p>{" "}
      <CodeCopy text={`sudo apt install flatpak`} />
    </li>

    <li>
      <h2>Install the Software Flatpak plugin</h2>
      <p>
        If you are running GNOME, it is also a good idea to install the Flatpak
        plugin for GNOME Software. To do this, run:
      </p>{" "}
      <CodeCopy text={`sudo apt install gnome-software-plugin-flatpak`} />{" "}
      <p>
        If you are running KDE, you should instead install the Plasma Discover
        Flatpak backend:
      </p>{" "}
      <CodeCopy text={`sudo apt install plasma-discover-backend-flatpak`} />
    </li>

    <li>
      <h2>Add the Flathub repository</h2>
      <p>
        Flathub is the best place to get Flatpak apps. To enable it, download
        and install the{" "}
        <a
          className="btn btn-default"
          href="https://dl.flathub.org/repo/flathub.flatpakrepo"
        >
          Flathub repository file
        </a>{" "}
        or run the following in a terminal:
      </p>{" "}
      <CodeCopy
        text={`flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo`}
      />
    </li>

    <li>
      <h2>Restart</h2>
      <p>
        To complete setup, restart your system. Now all you have to do is{" "}
        <a href="https://flathub.org/">install some apps</a>!
      </p>
    </li>
  </ol>
)
distroMap.set("Debian", <Debian />)

export const Rocky_Linux = () => (
  <ol className="distrotut">
    <HowToJsonLd
      name="Rocky Linux"
      image="https://flathub.org/img/distro/rockylinux.svg"
      estimatedCost={{ currency: "USD", value: "0" }}
      step={[
        {
          url: "https://flathub.org/setup/rocky_linux",
          name: "Install Flatpak",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "Flatpak is installed by default on Rocky Linux 8 and newer, when installed with a software selection that includes GNOME (Server with GUI, Workstation). If you are using such a system, you may skip this step. To install Flatpak on Rocky Linux, run the following in a terminal: sudo dnf install flatpak",
            },
          ],
        },
        {
          url: "https://flathub.org/setup/rocky_linux",
          name: "Add the Flathub repository",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "Flathub is the best place to get Flatpak apps. To enable it, download and install the Flathub repository file or run the following in a terminal: flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo",
            },
          ],
        },
        {
          url: "https://flathub.org/setup/rocky_linux",
          name: "Restart",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "To complete setup, restart your system. Now all you have to do is install some apps!",
            },
          ],
        },
      ]}
    />

    <li>
      <h2>Install Flatpak</h2>
      <p>
        Flatpak is installed by default on Rocky Linux 8 and newer, when
        installed with a software selection that includes GNOME (Server with
        GUI, Workstation). If you are using such a system, you may skip this
        step. To install Flatpak on Rocky Linux, run the following in a
        terminal:
      </p>{" "}
      <CodeCopy text={`sudo dnf install flatpak`} />
    </li>

    <li>
      <h2>Add the Flathub repository</h2>
      <p>
        Flathub is the best place to get Flatpak apps. To enable it, download
        and install the{" "}
        <a
          className="btn btn-default"
          href="https://dl.flathub.org/repo/flathub.flatpakrepo"
        >
          Flathub repository file
        </a>{" "}
        or run the following in a terminal:
      </p>{" "}
      <CodeCopy
        text={`flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo`}
      />
    </li>

    <li>
      <h2>Restart</h2>
      <p>
        To complete setup, restart your system. Now all you have to do is{" "}
        <a href="https://flathub.org/">install some apps</a>!
      </p>
    </li>
  </ol>
)
distroMap.set("Rocky Linux", <Rocky_Linux />)

export const CentOS = () => (
  <ol className="distrotut">
    <p>
      Flatpak is installed by default on CentOS 7 and newer, when using GNOME.
      To get started, all you need to do is enable Flathub, which is the best
      way to get Flatpak apps. Just download and install the{" "}
      <a
        className="btn btn-default"
        href="https://dl.flathub.org/repo/flathub.flatpakrepo"
      >
        Flathub repository file
      </a>
      .
    </p>{" "}
    <p>
      Now all you have to do is{" "}
      <a href="https://flathub.org/">install some apps</a>!
    </p>
  </ol>
)
distroMap.set("CentOS", <CentOS />)

export const EuroLinux = () => (
  <ol className="distrotut">
    <p>
      Flatpak is installed by default on EuroLinux 8 and newer, when using
      GNOME. To get started, all you need to do is enable Flathub, which is the
      best way to get Flatpak apps. Just download and install the{" "}
      <a
        className="btn btn-default"
        href="https://dl.flathub.org/repo/flathub.flatpakrepo"
      >
        Flathub repository file
      </a>
      .
    </p>{" "}
    <p>
      Now all you have to do is{" "}
      <a href="https://flathub.org/">install some apps</a>!
    </p>
  </ol>
)
distroMap.set("EuroLinux", <EuroLinux />)

export const AlmaLinux = () => (
  <ol className="distrotut">
    <p>
      Flatpak is installed by default on AlmaLinux 8 and newer, when using
      GNOME. To get started, all you need to do is enable Flathub, which is the
      best way to get Flatpak apps. Just download and install the{" "}
      <a
        className="btn btn-default"
        href="https://dl.flathub.org/repo/flathub.flatpakrepo"
      >
        Flathub repository file
      </a>
      .
    </p>{" "}
    <p>
      Now all you have to do is{" "}
      <a href="https://flathub.org/">install some apps</a>!
    </p>
  </ol>
)
distroMap.set("AlmaLinux", <AlmaLinux />)

export const Gentoo = () => (
  <ol className="distrotut">
    <HowToJsonLd
      name="Gentoo"
      image="https://flathub.org/img/distro/gentoo.svg"
      estimatedCost={{ currency: "USD", value: "0" }}
      step={[
        {
          url: "https://flathub.org/setup/gentoo",
          name: "Install Flatpak",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "To install Flatpak on Gentoo, simply run: emerge --ask --verbose sys-apps/flatpak",
            },
          ],
        },
        {
          url: "https://flathub.org/setup/gentoo",
          name: "Add the Flathub repository",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "Flathub is the best place to get Flatpak apps. To enable it, run: flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo",
            },
          ],
        },
        {
          url: "https://flathub.org/setup/gentoo",
          name: "Restart",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "To complete setup, restart your system. Now all you have to do is install some apps! Note: graphical installation of Flatpak apps may not be possible with Gentoo.",
            },
          ],
        },
      ]}
    />

    <li>
      <h2>Install Flatpak</h2>
      <p>To install Flatpak on Gentoo, simply run:</p>{" "}
      <CodeCopy text={`emerge --ask --verbose sys-apps/flatpak`} />
    </li>

    <li>
      <h2>Add the Flathub repository</h2>
      <p>
        Flathub is the best place to get Flatpak apps. To enable it, run:
      </p>{" "}
      <CodeCopy
        text={`flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo`}
      />
    </li>

    <li>
      <h2>Restart</h2>
      <p>
        To complete setup, restart your system. Now all you have to do is{" "}
        <a href="https://flathub.org/">install some apps</a>!
      </p>{" "}
      <p>
        Note: graphical installation of Flatpak apps may not be possible with
        Gentoo.
      </p>
    </li>
  </ol>
)
distroMap.set("Gentoo", <Gentoo />)

export const Kubuntu = () => (
  <ol className="distrotut">
    <HowToJsonLd
      name="Kubuntu"
      image="https://flathub.org/img/distro/kubuntu.svg"
      estimatedCost={{ currency: "USD", value: "0" }}
      step={[
        {
          url: "https://flathub.org/setup/kubuntu",
          name: "Install Flatpak",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "To install Flatpak on Kubuntu 18.10 (Cosmic Cuttlefish) or later, simply run: sudo apt install flatpak With older Kubuntu versions, the official Flatpak PPA is the recommended way to install Flatpak. To install it, run the following in a terminal: sudo add-apt-repository ppa:alexlarsson/flatpak sudo apt update sudo apt install flatpak",
            },
          ],
        },
        {
          url: "https://flathub.org/setup/kubuntu",
          name: "Install the Discover Flatpak backend",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "The Flatpak plugin for the Software app makes it possible to install apps without needing the command line (available on Kubuntu 18.04 and newer). To install on 20.04 or later, run: sudo apt install plasma-discover-backend-flatpak On Kubuntu 18.04, you should run this instead: sudo apt install plasma-discover-flatpak-backend",
            },
          ],
        },
        {
          url: "https://flathub.org/setup/kubuntu",
          name: "Add the Flathub repository",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "Flathub is the best place to get Flatpak apps. To enable it, download and install the Flathub repository file or run the following in a terminal: flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo",
            },
          ],
        },
        {
          url: "https://flathub.org/setup/kubuntu",
          name: "Restart",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "To complete setup, restart your system. Now all you have to do is install some apps!",
            },
          ],
        },
      ]}
    />

    <li>
      <h2>Install Flatpak</h2>
      <p>
        To install Flatpak on Kubuntu 18.10 (Cosmic Cuttlefish) or later, simply
        run:
      </p>{" "}
      <CodeCopy text={`sudo apt install flatpak`} />{" "}
      <p>
        With older Kubuntu versions, the official Flatpak PPA is the recommended
        way to install Flatpak. To install it, run the following in a terminal:
      </p>{" "}
      <CodeCopy
        text={` sudo add-apt-repository ppa:alexlarsson/flatpak
 sudo apt update
 sudo apt install flatpak
 `}
      />
    </li>

    <li>
      <h2>Install the Discover Flatpak backend</h2>
      <p>
        The Flatpak plugin for the Software app makes it possible to install
        apps without needing the command line (available on Kubuntu 18.04 and
        newer). To install on 20.04 or later, run:
      </p>{" "}
      <CodeCopy text={`sudo apt install plasma-discover-backend-flatpak`} />{" "}
      <p>On Kubuntu 18.04, you should run this instead:</p>{" "}
      <CodeCopy text={`sudo apt install plasma-discover-flatpak-backend`} />
    </li>

    <li>
      <h2>Add the Flathub repository</h2>
      <p>
        Flathub is the best place to get Flatpak apps. To enable it, download
        and install the{" "}
        <a
          className="btn btn-default"
          href="https://dl.flathub.org/repo/flathub.flatpakrepo"
        >
          Flathub repository file
        </a>{" "}
        or run the following in a terminal:
      </p>{" "}
      <CodeCopy
        text={`flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo`}
      />
    </li>

    <li>
      <h2>Restart</h2>
      <p>
        To complete setup, restart your system. Now all you have to do is{" "}
        <a href="https://flathub.org/">install some apps</a>!
      </p>
    </li>
  </ol>
)
distroMap.set("Kubuntu", <Kubuntu />)

export const Solus = () => (
  <ol className="distrotut">
    <HowToJsonLd
      name="Solus"
      image="https://flathub.org/img/distro/solus.svg"
      estimatedCost={{ currency: "USD", value: "0" }}
      step={[
        {
          url: "https://flathub.org/setup/solus",
          name: "Install Flatpak",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "To install Flatpak on Solus, simply run: sudo eopkg install flatpak",
            },
          ],
        },
        {
          url: "https://flathub.org/setup/solus",
          name: "Add the Flathub repository",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "Flathub is the best place to get Flatpak apps. To enable it, download and install the Flathub repository file or run the following in a terminal: flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo",
            },
          ],
        },
        {
          url: "https://flathub.org/setup/solus",
          name: "Restart",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "To complete setup, restart your system. Now all you have to do is install some apps! Note: graphical installation of Flatpak apps is not yet possible with Solus, but will be available in the near future.",
            },
          ],
        },
      ]}
    />

    <li>
      <h2>Install Flatpak</h2>
      <p>To install Flatpak on Solus, simply run:</p>{" "}
      <CodeCopy text={`sudo eopkg install flatpak`} />
    </li>

    <li>
      <h2>Add the Flathub repository</h2>
      <p>
        Flathub is the best place to get Flatpak apps. To enable it, download
        and install the{" "}
        <a
          className="btn btn-default"
          href="https://dl.flathub.org/repo/flathub.flatpakrepo"
        >
          Flathub repository file
        </a>{" "}
        or run the following in a terminal:
      </p>{" "}
      <CodeCopy
        text={`flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo`}
      />
    </li>

    <li>
      <h2>Restart</h2>
      <p>
        To complete setup, restart your system. Now all you have to do is{" "}
        <a href="https://flathub.org/">install some apps</a>!
      </p>{" "}
      <p>
        Note: graphical installation of Flatpak apps is not yet possible with
        Solus, but will be available in the near future.
      </p>
    </li>
  </ol>
)
distroMap.set("Solus", <Solus />)

export const Alpine = () => (
  <ol className="distrotut">
    <HowToJsonLd
      name="Alpine"
      image="https://flathub.org/img/distro/alpine.svg"
      estimatedCost={{ currency: "USD", value: "0" }}
      step={[
        {
          url: "https://flathub.org/setup/alpine",
          name: "Install Flatpak",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "Flatpak can be installed from the community repository. Run the following in a terminal: doas apk add flatpak",
            },
          ],
        },
        {
          url: "https://flathub.org/setup/alpine",
          name: "Install the Software Flatpak plugin",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "You can install the Flatpak plugin for either the GNOME Software (since v3.13) or KDE Discover (since v3.11), making it possible to install apps without needing the command line. To install, for GNOME Software run: doas apk add gnome-software-plugin-flatpak For KDE Discover run: doas apk add discover-backend-flatpak",
            },
          ],
        },
        {
          url: "https://flathub.org/setup/alpine",
          name: "Add the Flathub repository",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "Flathub is the best place to get Flatpak apps. To enable it, download and install the Flathub repository file or run the following in a terminal: flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo",
            },
          ],
        },
        {
          url: "https://flathub.org/setup/alpine",
          name: "Restart",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "To complete the setup, restart your system. Now all you have to do is install some apps!",
            },
          ],
        },
      ]}
    />

    <li>
      <h2>Install Flatpak</h2>
      <p>
        Flatpak can be installed from the community repository. Run the
        following in a terminal:
      </p>{" "}
      <CodeCopy text={`doas apk add flatpak`} />
    </li>

    <li>
      <h2>Install the Software Flatpak plugin</h2>
      <p>
        You can install the Flatpak plugin for either the GNOME Software (since
        v3.13) or KDE Discover (since v3.11), making it possible to install apps
        without needing the command line. To install, for GNOME Software run:
      </p>{" "}
      <CodeCopy text={`doas apk add gnome-software-plugin-flatpak`} />{" "}
      <p>For KDE Discover run:</p>{" "}
      <CodeCopy text={`doas apk add discover-backend-flatpak`} />
    </li>

    <li>
      <h2>Add the Flathub repository</h2>
      <p>
        Flathub is the best place to get Flatpak apps. To enable it, download
        and install the{" "}
        <a
          className="btn btn-default"
          href="https://dl.flathub.org/repo/flathub.flatpakrepo"
        >
          Flathub repository file
        </a>{" "}
        or run the following in a terminal:
      </p>{" "}
      <CodeCopy
        text={`flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo`}
      />
    </li>

    <li>
      <h2>Restart</h2>
      <p>
        To complete the setup, restart your system. Now all you have to do is{" "}
        <a href="https://flathub.org/">install some apps</a>!
      </p>
    </li>
  </ol>
)
distroMap.set("Alpine", <Alpine />)

export const Mageia = () => (
  <ol className="distrotut">
    <HowToJsonLd
      name="Mageia"
      image="https://flathub.org/img/distro/mageia.svg"
      estimatedCost={{ currency: "USD", value: "0" }}
      step={[
        {
          url: "https://flathub.org/setup/mageia",
          name: "Install Flatpak",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "A flatpak package is available for Mageia 6 and newer. To install with DNF, run the following as root: dnf install flatpak Or, to install with urpmi, run: urpmi flatpak",
            },
          ],
        },
        {
          url: "https://flathub.org/setup/mageia",
          name: "Add the Flathub repository",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "Flathub is the best place to get Flatpak apps. To enable it, download and install the Flathub repository file or run the following in a terminal: flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo",
            },
          ],
        },
        {
          url: "https://flathub.org/setup/mageia",
          name: "Restart",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "To complete setup, restart your system. Now all you have to do is install some apps! Note: graphical installation of Flatpak apps may not be possible with Mageia.",
            },
          ],
        },
      ]}
    />

    <li>
      <h2>Install Flatpak</h2>
      <p>
        A flatpak package is available for Mageia 6 and newer. To install with
        DNF, run the following as root:
      </p>{" "}
      <CodeCopy text={`dnf install flatpak`} />{" "}
      <p>
        Or, to install with <code>urpmi</code>, run:
      </p>{" "}
      <CodeCopy text={`urpmi flatpak`} />
    </li>

    <li>
      <h2>Add the Flathub repository</h2>
      <p>
        Flathub is the best place to get Flatpak apps. To enable it, download
        and install the{" "}
        <a
          className="btn btn-default"
          href="https://dl.flathub.org/repo/flathub.flatpakrepo"
        >
          Flathub repository file
        </a>{" "}
        or run the following in a terminal:
      </p>{" "}
      <CodeCopy
        text={`flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo`}
      />
    </li>

    <li>
      <h2>Restart</h2>
      <p>
        To complete setup, restart your system. Now all you have to do is{" "}
        <a href="https://flathub.org/">install some apps</a>!
      </p>{" "}
      <p>
        Note: graphical installation of Flatpak apps may not be possible with
        Mageia.
      </p>
    </li>
  </ol>
)
distroMap.set("Mageia", <Mageia />)

export const OpenMandriva_Lx = () => (
  <ol className="distrotut">
    <h2>
      Flatpak support is built into OpenMandriva for all actively supported
      versions, starting from the stable/fixed release 'Rock 5.0', through the
      development release 'Cooker', and ending with the rolling release 'ROME'.
    </h2>{" "}
    <p>Flatpak comes with the pre-configured Flathub repository.</p>
  </ol>
)
distroMap.set("OpenMandriva Lx", <OpenMandriva_Lx />)

export const Pop_OS = () => (
  <ol className="distrotut">
    <HowToJsonLd
      name="Pop!_OS"
      image="https://flathub.org/img/distro/pop-os.svg"
      estimatedCost={{ currency: "USD", value: "0" }}
      step={[
        {
          url: "https://flathub.org/setup/pop_os",
          name: "Install Flatpak",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "To install Flatpak on Pop!_OS 19.10 and earlier, simply run: sudo apt install flatpak",
            },
          ],
        },
        {
          url: "https://flathub.org/setup/pop_os",
          name: "Add the Flathub repository",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "Flathub is the best place to get Flatpak apps. To enable it, download and install the Flathub repository file or run the following in a terminal: flatpak remote-add --user --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo",
            },
          ],
        },
        {
          url: "https://flathub.org/setup/pop_os",
          name: "Restart",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "To complete setup, restart your system. Now all you have to do is install some apps! Note: graphical installation of Flatpak apps may not be possible with Pop!_OS 19.10 and earlier.",
            },
          ],
        },
      ]}
    />
    <h2>
      Flatpak support is built into Pop!_OS 20.04 and newer—no setup required!
    </h2>{" "}
    <p>
      If you are using an older version, you can refer to the instructions
      below.
    </p>
    <li>
      <h2>Install Flatpak</h2>
      <p>To install Flatpak on Pop!_OS 19.10 and earlier, simply run:</p>{" "}
      <CodeCopy text={`sudo apt install flatpak`} />
    </li>
    <li>
      <h2>Add the Flathub repository</h2>
      <p>
        Flathub is the best place to get Flatpak apps. To enable it, download
        and install the{" "}
        <a
          className="btn btn-default"
          href="https://dl.flathub.org/repo/flathub.flatpakrepo"
        >
          Flathub repository file
        </a>{" "}
        or run the following in a terminal:
      </p>{" "}
      <CodeCopy
        text={`flatpak remote-add --user --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo`}
      />
    </li>
    <li>
      <h2>Restart</h2>
      <p>
        To complete setup, restart your system. Now all you have to do is{" "}
        <a href="https://flathub.org/">install some apps</a>!
      </p>{" "}
      <p>
        Note: graphical installation of Flatpak apps may not be possible with
        Pop!_OS 19.10 and earlier.
      </p>
    </li>
  </ol>
)
distroMap.set("Pop!_OS", <Pop_OS />)

export const Elementary_OS = () => (
  <ol className="distrotut">
    <HowToJsonLd
      name="elementary OS"
      image="https://flathub.org/img/distro/elementary-os.svg"
      estimatedCost={{ currency: "USD", value: "0" }}
      step={[
        {
          url: "https://flathub.org/setup/elementary_os",
          name: "Install Some Apps",
          itemListElement: [
            {
              type: "HowToDirection",
              text: 'elementary OS 5.1 and newer comes with Flatpak support out of the box. For non-curated apps, head to Flathub to install any app using the big "Install" button, and open the downloaded `.flatpakref` file with Sideload. Note: After installing one app from a remote like Flathub, all other apps from that remote will also automatically show up in AppCenter.',
            },
          ],
        },
      ]}
    />

    <li>
      <h2>Install Some Apps</h2>
      <p>
        elementary OS 5.1 and newer comes with Flatpak support out of the box.
        For non-curated apps, head to <a href="https://flathub.org/">Flathub</a>{" "}
        to install any app using the big "Install" button, and open the
        downloaded `.flatpakref` file with Sideload.
      </p>{" "}
      <p>
        Note: After installing one app from a remote like Flathub, all other
        apps from that remote will also automatically show up in AppCenter.
      </p>
    </li>
  </ol>
)
distroMap.set("elementary OS", <Elementary_OS />)

export const Raspberry_Pi_OS = () => (
  <ol className="distrotut">
    <HowToJsonLd
      name="Raspberry Pi OS"
      image="https://flathub.org/img/distro/raspberry-pi-os.svg"
      estimatedCost={{ currency: "USD", value: "0" }}
      step={[
        {
          url: "https://flathub.org/setup/raspberry_pi_os",
          name: "Install Flatpak",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "A flatpak package is available in Raspberry Pi OS (previously called Raspbian) Stretch and newer. To install it, run the following as root: sudo apt install flatpak",
            },
          ],
        },
        {
          url: "https://flathub.org/setup/raspberry_pi_os",
          name: "Add the Flathub repository",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "Flathub is the best place to get Flatpak apps. To enable it, run: flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo Important note: As of March 2021, Raspberry Pi computers still ship with the 32-bit version of Raspberry Pi OS. However Flathub started phasing out support for that architecture. If you consider Flathub as an important source of applications, it is recommended to use Raspberry Pi OS 64-bit as newer applications are more likely to be available for that platform.",
            },
          ],
        },
        {
          url: "https://flathub.org/setup/raspberry_pi_os",
          name: "Restart",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "To complete setup, restart your system. Now all you have to do is install some apps! Note: graphical installation of Flatpak apps may not be possible with Raspberry Pi OS.",
            },
          ],
        },
      ]}
    />

    <li>
      <h2>Install Flatpak</h2>
      <p>
        A flatpak package is available in Raspberry Pi OS (previously called
        Raspbian) Stretch and newer. To install it, run the following as root:
      </p>{" "}
      <CodeCopy text={`sudo apt install flatpak`} />
    </li>

    <li>
      <h2>Add the Flathub repository</h2>
      <p>
        Flathub is the best place to get Flatpak apps. To enable it, run:
      </p>{" "}
      <CodeCopy
        text={`flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo`}
      />{" "}
      <p>
        <b>Important note:</b> As of March 2021, Raspberry Pi computers still
        ship with the 32-bit version of Raspberry Pi OS. However Flathub started
        phasing out support for that architecture. If you consider Flathub as an
        important source of applications, it is recommended to use Raspberry Pi
        OS 64-bit as newer applications are more likely to be available for that
        platform.
      </p>
    </li>

    <li>
      <h2>Restart</h2>
      <p>
        To complete setup, restart your system. Now all you have to do is{" "}
        <a href="https://flathub.org/">install some apps</a>!
      </p>{" "}
      <p>
        Note: graphical installation of Flatpak apps may not be possible with
        Raspberry Pi OS.
      </p>
    </li>
  </ol>
)
distroMap.set("Raspberry Pi OS", <Raspberry_Pi_OS />)

export const Clear_Linux = () => (
  <ol className="distrotut">
    <p>
      Flatpak is installed and Flathub repository is pre-configured by default
      on Clear Linux when installing the desktop bundle.
    </p>{" "}
    <CodeCopy text={`sudo swupd bundle-add desktop`} />{" "}
    <p>
      Now all you have to do is{" "}
      <a href="https://flathub.org/">install some apps</a>!
    </p>
  </ol>
)
distroMap.set("Clear Linux", <Clear_Linux />)

export const Void_Linux = () => (
  <ol className="distrotut">
    <HowToJsonLd
      name="Void Linux"
      image="https://flathub.org/img/distro/void.svg"
      estimatedCost={{ currency: "USD", value: "0" }}
      step={[
        {
          url: "https://flathub.org/setup/void_linux",
          name: "Install Flatpak",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "To install Flatpak on Void Linux, run the following in a terminal: sudo xbps-install -S flatpak",
            },
          ],
        },
        {
          url: "https://flathub.org/setup/void_linux",
          name: "Add the Flathub repository",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "Flathub is the best place to get Flatpak apps. To enable it, run: flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo",
            },
          ],
        },
        {
          url: "https://flathub.org/setup/void_linux",
          name: "Restart",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "To complete setup, restart your system. Now all you have to do is install some apps!",
            },
          ],
        },
      ]}
    />

    <li>
      <h2>Install Flatpak</h2>
      <p>
        To install Flatpak on Void Linux, run the following in a terminal:
      </p>{" "}
      <CodeCopy text={`sudo xbps-install -S flatpak`} />
    </li>

    <li>
      <h2>Add the Flathub repository</h2>
      <p>
        Flathub is the best place to get Flatpak apps. To enable it, run:
      </p>{" "}
      <CodeCopy
        text={`flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo`}
      />
    </li>

    <li>
      <h2>Restart</h2>
      <p>
        To complete setup, restart your system. Now all you have to do is{" "}
        <a href="https://flathub.org/">install some apps</a>!
      </p>
    </li>
  </ol>
)
distroMap.set("Void Linux", <Void_Linux />)

export const NixOS = () => (
  <ol className="distrotut">
    <HowToJsonLd
      name="NixOS"
      image="https://flathub.org/img/distro/nixos.svg"
      estimatedCost={{ currency: "USD", value: "0" }}
      step={[
        {
          url: "https://flathub.org/setup/nixos",
          name: "Install Flatpak",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "To install Flatpak, set NixOS option services.flatpak.enable to true by putting the following into your /etc/nixos/configuration.nix: services.flatpak.enable = true; Then, rebuild and switch to the new configuration with: sudo nixos-rebuild switch For more details see the NixOS documentation.",
            },
          ],
        },
        {
          url: "https://flathub.org/setup/nixos",
          name: "Add the Flathub repository",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "Flathub is the best place to get Flatpak apps. To enable it, run: flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo",
            },
          ],
        },
        {
          url: "https://flathub.org/setup/nixos",
          name: "Restart",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "To complete setup, restart your system. Now all you have to do is install some apps!",
            },
          ],
        },
      ]}
    />

    <li>
      <h2>Install Flatpak</h2>
      <p>
        To install Flatpak, set NixOS option{" "}
        <code>services.flatpak.enable</code> to <code>true</code> by putting the
        following into your <code>/etc/nixos/configuration.nix</code>:
      </p>{" "}
      <CodeCopy text={`services.flatpak.enable = true;`} />{" "}
      <p>Then, rebuild and switch to the new configuration with:</p>{" "}
      <CodeCopy text={`sudo nixos-rebuild switch`} />{" "}
      <p>
        For more details see the{" "}
        <a href="https://nixos.org/manual/nixos/stable/index.html#module-services-flatpak">
          NixOS documentation
        </a>
        .
      </p>
    </li>

    <li>
      <h2>Add the Flathub repository</h2>
      <p>
        Flathub is the best place to get Flatpak apps. To enable it, run:
      </p>{" "}
      <CodeCopy
        text={`flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo`}
      />
    </li>

    <li>
      <h2>Restart</h2>
      <p>
        To complete setup, restart your system. Now all you have to do is{" "}
        <a href="https://flathub.org/">install some apps</a>!
      </p>
    </li>
  </ol>
)
distroMap.set("NixOS", <NixOS />)

export const PureOS = () => (
  <ol className="distrotut">
    <p>
      Flatpak is installed by default on PureOS. To get started, all you need to
      do is enable Flathub, which is the best way to get Flatpak apps. Just
      download and install the{" "}
      <a
        className="btn btn-default"
        href="https://dl.flathub.org/repo/flathub.flatpakrepo"
      >
        Flathub repository file
      </a>
      .
    </p>{" "}
    <p>
      Now all you have to do is{" "}
      <a href="https://flathub.org/">install some apps</a>!
    </p>
  </ol>
)
distroMap.set("PureOS", <PureOS />)

export const Turkman_Linux = () => (
  <ol className="distrotut">
    <HowToJsonLd
      name="Turkman Linux"
      image="https://flathub.org/img/distro/turkman.svg"
      estimatedCost={{ currency: "USD", value: "0" }}
      step={[
        {
          url: "https://flathub.org/setup/turkman_linux",
          name: "Install Flatpak",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "To install Flatpak on Turkman Linux, run the following in a terminal: Emerge way ymp install build-base --no-emerge\n ymp install flatpak\n No emerge way ymp install flatpak --no-emerge",
            },
          ],
        },
        {
          url: "https://flathub.org/setup/turkman_linux",
          name: "Enable services",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "To enable services on Turkman Linux, run the following in a terminal: rc-update add devfs\n rc-update add fuse\n rc-update add hostname\n",
            },
          ],
        },
        {
          url: "https://flathub.org/setup/turkman_linux",
          name: "Add the Flathub repository",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "Flathub is the best place to get Flatpak apps. To enable it, run: flatpak --user remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo",
            },
          ],
        },
        {
          url: "https://flathub.org/setup/turkman_linux",
          name: "Restart",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "To complete setup, restart your system. Now all you have to do is install some apps! Note: graphical installation of Flatpak apps may not be possible with Turkman Linux.",
            },
          ],
        },
      ]}
    />

    <li>
      <h2>Install Flatpak</h2>
      <p>
        To install Flatpak on Turkman Linux, run the following in a terminal:
      </p>{" "}
      <p>Emerge way</p>{" "}
      <CodeCopy
        text={` ymp install build-base --no-emerge\n ymp install flatpak\n `}
      />{" "}
      <p>No emerge way</p> <CodeCopy text={`ymp install flatpak --no-emerge`} />
    </li>

    <li>
      <h2>Enable services</h2>
      <p>
        To enable services on Turkman Linux, run the following in a terminal:
      </p>{" "}
      <CodeCopy
        text={` rc-update add devfs\n rc-update add fuse\n rc-update add hostname\n `}
      />
    </li>

    <li>
      <h2>Add the Flathub repository</h2>
      <p>
        Flathub is the best place to get Flatpak apps. To enable it, run:
      </p>{" "}
      <CodeCopy
        text={`flatpak --user remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo`}
      />
    </li>

    <li>
      <h2>Restart</h2>
      <p>
        To complete setup, restart your system. Now all you have to do is{" "}
        <a href="https://flathub.org/">install some apps</a>!
      </p>{" "}
      <p>
        Note: graphical installation of Flatpak apps may not be possible with
        Turkman Linux.
      </p>
    </li>
  </ol>
)
distroMap.set("Turkman Linux", <Turkman_Linux />)

export const Ataraxia_Linux = () => (
  <ol className="distrotut">
    <HowToJsonLd
      name="Ataraxia Linux"
      image="https://flathub.org/img/distro/ataraxia.svg"
      estimatedCost={{ currency: "USD", value: "0" }}
      step={[
        {
          url: "https://flathub.org/setup/ataraxia_linux",
          name: "Install Flatpak",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "To install Flatpak on Ataraxia Linux, run the following in a terminal: sudo neko em flatpak",
            },
          ],
        },
        {
          url: "https://flathub.org/setup/ataraxia_linux",
          name: "Add the Flathub repository",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "Flathub is the best place to get Flatpak apps. To enable it, run: flatpak --user remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo",
            },
          ],
        },
        {
          url: "https://flathub.org/setup/ataraxia_linux",
          name: "Restart",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "To complete setup, restart your system. Now all you have to do is install some apps!",
            },
          ],
        },
      ]}
    />

    <li>
      <h2>Install Flatpak</h2>
      <p>
        To install Flatpak on Ataraxia Linux, run the following in a terminal:
      </p>{" "}
      <CodeCopy text={`sudo neko em flatpak`} />
    </li>

    <li>
      <h2>Add the Flathub repository</h2>
      <p>
        Flathub is the best place to get Flatpak apps. To enable it, run:
      </p>{" "}
      <CodeCopy
        text={`flatpak --user remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo`}
      />
    </li>

    <li>
      <h2>Restart</h2>
      <p>
        To complete setup, restart your system. Now all you have to do is{" "}
        <a href="https://flathub.org/">install some apps</a>!
      </p>
    </li>
  </ol>
)
distroMap.set("Ataraxia Linux", <Ataraxia_Linux />)

export const Zorin_OS = () => (
  <ol className="distrotut">
    <h2>Flatpak support is built into Zorin OS</h2>{" "}
    <p>You can use the Software Store app to download flatpak apps.</p>
  </ol>
)
distroMap.set("Zorin OS", <Zorin_OS />)

export const Deepin = () => (
  <ol className="distrotut">
    <HowToJsonLd
      name="Deepin"
      image="https://flathub.org/img/distro/deepin.svg"
      estimatedCost={{ currency: "USD", value: "0" }}
      step={[
        {
          url: "https://flathub.org/setup/deepin",
          name: "Install Flatpak",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "To install Flatpak on Deepin, run the following in a terminal: sudo apt install flatpak",
            },
          ],
        },
        {
          url: "https://flathub.org/setup/deepin",
          name: "Add the Flathub repository",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "Flathub is the best place to get Flatpak apps. To enable it, run: flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo",
            },
          ],
        },
        {
          url: "https://flathub.org/setup/deepin",
          name: "Install the Deepin themes",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "To install light and dark themes, run: flatpak install flathub org.gtk.Gtk3theme.deepin\n flatpak install flathub org.gtk.Gtk3theme.deepin-dark\n",
            },
          ],
        },
        {
          url: "https://flathub.org/setup/deepin",
          name: "Restart",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "To complete setup, restart your system. Now all you have to do is install some apps!",
            },
          ],
        },
      ]}
    />

    <li>
      <h2>Install Flatpak</h2>
      <p>To install Flatpak on Deepin, run the following in a terminal:</p>{" "}
      <CodeCopy text={`sudo apt install flatpak`} />
    </li>

    <li>
      <h2>Add the Flathub repository</h2>
      <p>
        Flathub is the best place to get Flatpak apps. To enable it, run:
      </p>{" "}
      <CodeCopy
        text={`flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo`}
      />
    </li>

    <li>
      <h2>Install the Deepin themes</h2>
      <p>To install light and dark themes, run:</p>{" "}
      <CodeCopy
        text={` flatpak install flathub org.gtk.Gtk3theme.deepin\n flatpak install flathub org.gtk.Gtk3theme.deepin-dark\n `}
      />
    </li>

    <li>
      <h2>Restart</h2>
      <p>
        To complete setup, restart your system. Now all you have to do is{" "}
        <a href="https://flathub.org/">install some apps</a>!
      </p>
    </li>
  </ol>
)
distroMap.set("Deepin", <Deepin />)

export const Pardus = () => (
  <ol className="distrotut">
    <HowToJsonLd
      name="Pardus"
      image="https://flathub.org/img/distro/pardus.svg"
      estimatedCost={{ currency: "USD", value: "0" }}
      step={[
        {
          url: "https://flathub.org/setup/pardus",
          name: "Install Flatpak",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "A flatpak package is available in Pardus 2019 and newer. To install it, run the following as root: sudo apt install flatpak For Pardus 2017 and older versions, a flatpak package is available in the official backports repository.",
            },
          ],
        },
        {
          url: "https://flathub.org/setup/pardus",
          name: "Install the Software Flatpak plugin",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "If you are running GNOME, it is also a good idea to install the Flatpak plugin for GNOME Software. To do this, run: sudo apt install gnome-software-plugin-flatpak",
            },
          ],
        },
        {
          url: "https://flathub.org/setup/pardus",
          name: "Add the Flathub repository",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "Flathub is the best place to get Flatpak apps. To enable it, run: flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo",
            },
          ],
        },
        {
          url: "https://flathub.org/setup/pardus",
          name: "Restart",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "To complete setup, restart your system. Now all you have to do is install some apps!",
            },
          ],
        },
      ]}
    />

    <li>
      <h2>Install Flatpak</h2>
      <p>
        A flatpak package is available in Pardus 2019 and newer. To install it,
        run the following as root:
      </p>{" "}
      <CodeCopy text={`sudo apt install flatpak`} />{" "}
      <p>
        For Pardus 2017 and older versions, a flatpak package is available in
        the{" "}
        <a href="https://backports.debian.org/Instructions/">
          official backports repository
        </a>
        .{" "}
      </p>
    </li>

    <li>
      <h2>Install the Software Flatpak plugin</h2>
      <p>
        If you are running GNOME, it is also a good idea to install the Flatpak
        plugin for GNOME Software. To do this, run:
      </p>{" "}
      <CodeCopy text={`sudo apt install gnome-software-plugin-flatpak`} />
    </li>

    <li>
      <h2>Add the Flathub repository</h2>
      <p>
        Flathub is the best place to get Flatpak apps. To enable it, run:
      </p>{" "}
      <CodeCopy
        text={`flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo`}
      />
    </li>

    <li>
      <h2>Restart</h2>
      <p>
        To complete setup, restart your system. Now all you have to do is{" "}
        <a href="https://flathub.org/">install some apps</a>!
      </p>
    </li>
  </ol>
)
distroMap.set("Pardus", <Pardus />)

export const MX_Linux = () => (
  <ol className="distrotut">
    <HowToJsonLd
      name="MX Linux"
      image="https://flathub.org/img/distro/mxlinux.svg"
      estimatedCost={{ currency: "USD", value: "0" }}
      step={[
        {
          url: "https://flathub.org/setup/mx_linux",
          name: "Enable Flatpak through the Software Manager",
          itemListElement: [
            {
              type: "HowToDirection",
              text: 'Flatpak support is built in from MX 18 and later. It is only required to activate the Flathub repository following these instructions: Open MX Package Installer (open the menu and look in MX Tools), select the "Flatpaks" tab, to activate the repository you will need to enter the root password.',
            },
          ],
        },
        {
          url: "https://flathub.org/setup/mx_linux",
          name: "Restart",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "To complete setup, restart your system. Now all you have to do is install some apps!",
            },
          ],
        },
      ]}
    />

    <li>
      <h2>Enable Flatpak through the Software Manager</h2>
      <p>
        Flatpak support is built in from MX 18 and later. It is only required to
        activate the Flathub repository following these instructions:
      </p>{" "}
      <p>
        Open <strong>MX Package Installer</strong> (open the menu and look in MX
        Tools), select the "Flatpaks" tab, to activate the repository you will
        need to enter the root password.
      </p>
    </li>

    <li>
      <h2>Restart</h2>
      <p>
        To complete setup, restart your system. Now all you have to do is{" "}
        <a href="https://flathub.org/">install some apps</a>!
      </p>
    </li>
  </ol>
)
distroMap.set("MX Linux", <MX_Linux />)

export const Pisi_GNULinux = () => (
  <ol className="distrotut">
    <HowToJsonLd
      name="Pisi GNULinux"
      image="https://flathub.org/img/distro/pisi.svg"
      estimatedCost={{ currency: "USD", value: "0" }}
      step={[
        {
          url: "https://flathub.org/setup/pisi_gnulinux",
          name: "Install Flatpak",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "A flatpak package is available in Pisi 2.1 and newer. To install it, run the following as root: sudo pisi it flatpak",
            },
          ],
        },
        {
          url: "https://flathub.org/setup/pisi_gnulinux",
          name: "Add the Flathub repository",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "Flathub is the best place to get Flatpak apps. To enable it, run: flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo",
            },
          ],
        },
        {
          url: "https://flathub.org/setup/pisi_gnulinux",
          name: "Restart",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "To complete setup, restart your system. Now all you have to do is install some apps! Note: graphical installation of Flatpak apps may not be possible with Pisi GNU/Linux.",
            },
          ],
        },
      ]}
    />

    <li>
      <h2>Install Flatpak</h2>
      <p>
        A flatpak package is available in Pisi 2.1 and newer. To install it, run
        the following as root:
      </p>{" "}
      <CodeCopy text={`sudo pisi it flatpak`} />
    </li>

    <li>
      <h2>Add the Flathub repository</h2>
      <p>
        Flathub is the best place to get Flatpak apps. To enable it, run:
      </p>{" "}
      <CodeCopy
        text={`flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo`}
      />
    </li>

    <li>
      <h2>Restart</h2>
      <p>
        To complete setup, restart your system. Now all you have to do is{" "}
        <a href="https://flathub.org/">install some apps</a>!
      </p>{" "}
      <p>
        Note: graphical installation of Flatpak apps may not be possible with
        Pisi GNU/Linux.
      </p>
    </li>
  </ol>
)
distroMap.set("Pisi GNULinux", <Pisi_GNULinux />)

export const EndeavourOS = () => (
  <ol className="distrotut">
    <HowToJsonLd
      name="EndeavourOS"
      image="https://flathub.org/img/distro/endeavouros.svg"
      estimatedCost={{ currency: "USD", value: "0" }}
      step={[
        {
          url: "https://flathub.org/setup/endeavouros",
          name: "Install Flatpak",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "To install Flatpak on EndeavorOS, you must first make sure your installation is up to date, run the following in a terminal: sudo pacman -Syu Then install Flatpak: sudo pacman -S flatpak",
            },
          ],
        },
        {
          url: "https://flathub.org/setup/endeavouros",
          name: "Add the Flathub repository",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "Flathub is the best place to get Flatpak apps. To enable it, run: flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo",
            },
          ],
        },
        {
          url: "https://flathub.org/setup/endeavouros",
          name: "Restart",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "To complete setup, restart your system. Now all you have to do is install some apps! Note: graphical installation of Flatpak apps may not be possible with EndeavourOS.",
            },
          ],
        },
      ]}
    />

    <li>
      <h2>Install Flatpak</h2>
      <p>
        To install Flatpak on EndeavorOS, you must first make sure your
        installation is up to date, run the following in a terminal:
      </p>{" "}
      <CodeCopy text={`sudo pacman -Syu`} /> <p>Then install Flatpak:</p>{" "}
      <CodeCopy text={`sudo pacman -S flatpak`} />
    </li>

    <li>
      <h2>Add the Flathub repository</h2>
      <p>
        Flathub is the best place to get Flatpak apps. To enable it, run:
      </p>{" "}
      <CodeCopy
        text={`flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo`}
      />
    </li>

    <li>
      <h2>Restart</h2>
      <p>
        To complete setup, restart your system. Now all you have to do is{" "}
        <a href="https://flathub.org/">install some apps</a>!
      </p>{" "}
      <p>
        Note: graphical installation of Flatpak apps may not be possible with
        EndeavourOS.
      </p>
    </li>
  </ol>
)
distroMap.set("EndeavourOS", <EndeavourOS />)

export const KDE_neon = () => (
  <ol className="distrotut">
    <HowToJsonLd
      name="KDE neon"
      image="https://flathub.org/img/distro/kdeneon.svg"
      estimatedCost={{ currency: "USD", value: "0" }}
      step={[
        {
          url: "https://flathub.org/setup/kde_neon",
          name: "Enable Flatpak",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "Open Discover and click on Settings (lower left corner).",
            },
          ],
        },
        {
          url: "https://flathub.org/setup/kde_neon",
          name: "Check Flatpak settings",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "Check that in the Flatpak section the box is checked.Note: with this Flathub app search will be integrated in Discover, if you want to limit the app search to Flathub you can mark Flatpak as default by clicking on the star.",
            },
          ],
        },
      ]}
    />
    <h2>
      Flatpak support is built into KDE neon 19 and newer—no setup required!
    </h2>{" "}
    <p>
      If you are using an older version, you can refer to the instructions
      below.
    </p>
    <li>
      <h2>Enable Flatpak</h2>
      Open Discover and click on Settings (lower left corner).
    </li>
    <li>
      <h2>Check Flatpak settings</h2>
      <p>Check that in the Flatpak section the box is checked.</p>
      <p>
        Note: with this Flathub app search will be integrated in Discover, if
        you want to limit the app search to Flathub you can mark Flatpak as
        default by clicking on the star.
      </p>
    </li>
  </ol>
)
distroMap.set("KDE neon", <KDE_neon />)

export const GNU_Guix = () => (
  <ol className="distrotut">
    <HowToJsonLd
      name="GNU Guix"
      image="https://flathub.org/img/distro/guix.svg"
      estimatedCost={{ currency: "USD", value: "0" }}
      step={[
        {
          url: "https://flathub.org/setup/gnu_guix",
          name: "Install Flatpak",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "To install Flatpak on GNU Guix, run the following in a terminal: guix install flatpak",
            },
          ],
        },
        {
          url: "https://flathub.org/setup/gnu_guix",
          name: "Add the Flathub repository",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "Flathub is the best place to get Flatpak apps. To enable it, run: flatpak --user remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo",
            },
          ],
        },
        {
          url: "https://flathub.org/setup/gnu_guix",
          name: "Restart",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "To complete setup, restart your system. Now all you have to do is install some apps! Note: graphical installation of Flatpak apps may not be possible with GNU Guix.",
            },
          ],
        },
      ]}
    />

    <li>
      <h2>Install Flatpak</h2>
      <p>
        To install Flatpak on GNU Guix, run the following in a terminal:
      </p>{" "}
      <CodeCopy text={`guix install flatpak`} />
    </li>

    <li>
      <h2>Add the Flathub repository</h2>
      <p>
        Flathub is the best place to get Flatpak apps. To enable it, run:
      </p>{" "}
      <CodeCopy
        text={`flatpak --user remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo`}
      />
    </li>

    <li>
      <h2>Restart</h2>
      <p>
        To complete setup, restart your system. Now all you have to do is{" "}
        <a href="https://flathub.org/">install some apps</a>!
      </p>{" "}
      <p>
        Note: graphical installation of Flatpak apps may not be possible with
        GNU Guix.
      </p>
    </li>
  </ol>
)
distroMap.set("GNU Guix", <GNU_Guix />)

export const Crystal_Linux = () => (
  <ol className="distrotut">
    <HowToJsonLd
      name="Crystal Linux"
      image="https://flathub.org/img/distro/crystallinux.svg"
      estimatedCost={{ currency: "USD", value: "0" }}
      step={[
        {
          url: "https://flathub.org/setup/crystal_linux",
          name: "Install Flatpak",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "To install Flatpak in Crystal Linux, you must first make sure your packages are up to date. Run the following in a terminal: ame upg Then install Flatpak: ame ins flatpak",
            },
          ],
        },
        {
          url: "https://flathub.org/setup/crystal_linux",
          name: "Add the Flathub repository",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "Flathub is the best place to get Flatpak apps. To enable it, run: flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo",
            },
          ],
        },
        {
          url: "https://flathub.org/setup/crystal_linux",
          name: "Restart",
          itemListElement: [
            {
              type: "HowToDirection",
              text: "To complete setup, restart your system. Now all you have to do is install some apps!",
            },
          ],
        },
      ]}
    />
    <h2>Flatpak is installed by default on Crystal Linux.</h2>{" "}
    <p>
      If you didn't use jade_gui to install crystal or selected not to install
      it, you can set Flatpak up by using the following steps.
    </p>
    <li>
      <h2>Install Flatpak</h2>
      <p>
        To install Flatpak in Crystal Linux, you must first make sure your
        packages are up to date. Run the following in a terminal:
      </p>{" "}
      <CodeCopy text={`ame upg`} /> <p>Then install Flatpak:</p>{" "}
      <CodeCopy text={`ame ins flatpak`} />
    </li>
    <li>
      <h2>Add the Flathub repository</h2>
      <p>
        Flathub is the best place to get Flatpak apps. To enable it, run:
      </p>{" "}
      <CodeCopy
        text={`flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo`}
      />
    </li>
    <li>
      <h2>Restart</h2>
      <p>
        To complete setup, restart your system. Now all you have to do is{" "}
        <a href="https://flathub.org/">install some apps</a>!
      </p>
    </li>
  </ol>
)
distroMap.set("Crystal Linux", <Crystal_Linux />)

export const Vanilla_OS = () => (
  <ol className="distrotut">
    <h2>Flatpak is installed by default on Vanilla OS.</h2>{" "}
    <p>
      You can use the Software app or browse{" "}
      <a href="https://flathub.org/">Flathub</a> to install some apps.
    </p>{" "}
    <p>
      If for some reason Flathub is not available, you can configure it manually
      using the following command:
    </p>{" "}
    <CodeCopy
      text={`host-shell flatpak remote-add --user --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo`}
    />
  </ol>
)
distroMap.set("Vanilla OS", <Vanilla_OS />)

export const Salix = () => (
  <ol className="distrotut">
    <h2>
      Flatpak is installed by default on Salix since version 15.0—no setup
      required!
    </h2>{" "}
    <p>
      Flatpak comes preconfigured with the Flathub repository and desktop
      integration tools are included to allow 1-click install from Flathub.
    </p>{" "}
    <p>
      All you have to do is <a href="https://flathub.org/">install some apps</a>
      !
    </p>
  </ol>
)
distroMap.set("Salix", <Salix />)

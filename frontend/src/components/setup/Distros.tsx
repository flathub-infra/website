export const distroMap = new Map<string, JSX.Element>()
import CodeCopy from "src/components/application/CodeCopy"
export const Ubuntu = () => (
  <ol className="distrotut">
    {" "}
    <li>
      {" "}
      <h2>Install Flatpak</h2>{" "}
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
        text={`      sudo add-apt-repository ppa:flatpak/stable\n      sudo apt update\n      sudo apt install flatpak\n    `}
      />{" "}
    </li>{" "}
    <li>
      {" "}
      <h2>Install the Software Flatpak plugin</h2>{" "}
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
      </p>{" "}
    </li>{" "}
    <li>
      {" "}
      <h2>Add the Flathub repository</h2>{" "}
      <p>Flathub is the best place to get Flatpak apps. To enable it, run:</p>{" "}
      <CodeCopy
        text={`      flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo\n    `}
      />{" "}
    </li>{" "}
    <li>
      {" "}
      <h2>Restart</h2>{" "}
      <p>
        To complete setup, restart your system. Now all you have to do is{" "}
        <a href="https://flathub.org/">install some apps</a>!
      </p>{" "}
    </li>
  </ol>
)
distroMap.set("Ubuntu", <Ubuntu />)

export const Fedora = () => (
  <ol className="distrotut">
    {" "}
    {/*  Flatpak has been installed by default on Fedora Workstation since F25. Previous versions are past end of life, so don’t need to be mentioned.  */}{" "}
    <p>
      Flatpak is installed by default on Fedora Workstation, Fedora Silverblue,
      and Fedora Kinoite. To get started, all you need to do is enable Flathub,
      which is the best way to get Flatpak apps. Just download and install the{" "}
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
      text={`    flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo\n  `}
    />
  </ol>
)
distroMap.set("Fedora", <Fedora />)

export const Manjaro = () => (
  <ol className="distrotut">
    {" "}
    <li>
      {" "}
      <h2>Enable Flatpak through the Software Manager</h2>{" "}
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
      </p>{" "}
    </li>{" "}
    <li>
      {" "}
      <h2>Restart</h2>{" "}
      <p>
        To complete setup, restart your system. Now all you have to do is{" "}
        <a href="https://flathub.org/">install some apps</a>!
      </p>{" "}
    </li>
  </ol>
)
distroMap.set("Manjaro", <Manjaro />)

export const Endless_OS = () => (
  <ol className="distrotut">
    {" "}
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

export const Chrome_OS = () => (
  <ol className="distrotut">
    {" "}
    <p>
      Flatpak applications can be installed on ChromeOS with the Crostini Linux
      compatibility layer. This is not available for all ChromeOS devices, so
      you should ensure your device is compatible before proceeding. A list of
      compatible devices is maintained{" "}
      <a href="https://www.reddit.com/r/Crostini/wiki/getstarted/crostini-enabled-devices">
        here
      </a>
      .
    </p>{" "}
    <li>
      {" "}
      <h2>Enable Linux support</h2>{" "}
      <p>
        Navigate to <a href="chrome://os-settings">chrome://os-settings</a>, and
        scroll down to <strong>Developers</strong> and turn on{" "}
        <i>Linux development environment</i>. ChromeOS will take some time
        downloading and installing Linux.
      </p>{" "}
    </li>{" "}
    <li>
      {" "}
      <h2>Start a Linux terminal</h2>{" "}
      <p>
        Press the Search/Launcher key, type "Terminal", and launch the Terminal
        app.
      </p>{" "}
    </li>{" "}
    <li>
      {" "}
      <h2>Install Flatpak</h2>{" "}
      <p>To install Flatpak, run the following in the terminal:</p>{" "}
      <CodeCopy text={`      sudo apt install flatpak\n    `} />{" "}
      <p>
        A more up to date flatpak package is available in the{" "}
        <a href="https://backports.debian.org/Instructions/">
          Debian backports repository
        </a>
        .{" "}
      </p>{" "}
    </li>{" "}
    <li>
      {" "}
      <h2>Add the Flathub repository</h2>{" "}
      <p>Flathub is the best place to get Flatpak apps. To enable it, run:</p>{" "}
      <CodeCopy
        text={`      flatpak --user remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo\n    `}
      />{" "}
    </li>{" "}
    <li>
      {" "}
      <h2>Restart</h2>{" "}
      <p>
        To complete setup, restart Linux. You can do this by right-clicking
        terminal, and then clicking "Shut down Linux". Now all you have to do is{" "}
        <a href="https://flathub.org/">install some apps</a>!
      </p>{" "}
    </li>
  </ol>
)
distroMap.set("Chrome OS", <Chrome_OS />)

export const Red_Hat_Enterprise_Linux = () => (
  <ol className="distrotut">
    {" "}
    <h2>Install Flatpak</h2>{" "}
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
      text={`    flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo\n  `}
    />
  </ol>
)
distroMap.set("Red Hat Enterprise Linux", <Red_Hat_Enterprise_Linux />)

export const Linux_Mint = () => (
  <ol className="distrotut">
    {" "}
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
    {" "}
    <li>
      {" "}
      <h2>Install Flatpak</h2>{" "}
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
      <CodeCopy text={`sudo zypper install flatpak`} />{" "}
    </li>{" "}
    <li>
      {" "}
      <h2>Add the Flathub repository</h2>{" "}
      <p>Flathub is the best place to get Flatpak apps. To enable it, run:</p>{" "}
      <CodeCopy
        text={`      flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo\n    `}
      />{" "}
    </li>{" "}
    <li>
      {" "}
      <h2>Restart</h2>{" "}
      <p>
        To complete setup, restart your system. Now all you have to do is{" "}
        <a href="https://flathub.org/">install some apps</a>!
      </p>{" "}
    </li>
  </ol>
)
distroMap.set("openSUSE", <OpenSUSE />)

export const Arch = () => (
  <ol className="distrotut">
    {" "}
    <li>
      {" "}
      <h2>Install Flatpak</h2>{" "}
      <p>To install Flatpak, run the following in a terminal:</p>{" "}
      <CodeCopy text={`sudo pacman -S flatpak`} />{" "}
    </li>{" "}
    {/*  On arch, Flathub is added when the Flatpak package is installed.  */}{" "}
    {/*  Apparently the GNOME Software Flatpak plugin is shipped as part of the GNOME Software package, so there\'s no need to separately install it  */}{" "}
    <li>
      {" "}
      <h2>Restart</h2>{" "}
      <p>
        To complete setup, restart your system. Now all you have to do is{" "}
        <a href="https://flathub.org/">install some apps</a>!
      </p>{" "}
    </li>
  </ol>
)
distroMap.set("Arch", <Arch />)

export const Debian = () => (
  <ol className="distrotut">
    {" "}
    <li>
      {" "}
      <h2>Install Flatpak</h2>{" "}
      <p>
        A flatpak package is available in Debian Buster and newer. To install
        it, run the following as root:
      </p>{" "}
      <CodeCopy text={`apt install flatpak`} />{" "}
    </li>{" "}
    <li>
      {" "}
      <h2>Install the Software Flatpak plugin</h2>{" "}
      <p>
        If you are running GNOME, it is also a good idea to install the Flatpak
        plugin for GNOME Software. To do this, run:
      </p>{" "}
      <CodeCopy text={`apt install gnome-software-plugin-flatpak`} />{" "}
      <p>
        If you are running KDE Plasma, you can install the Flatpak plugin for
        KDE Discover instead:
      </p>{" "}
      <CodeCopy text={`apt install plasma-discover-backend-flatpak`} />{" "}
    </li>{" "}
    <li>
      {" "}
      <h2>Add the Flathub repository</h2>{" "}
      <p>Flathub is the best place to get Flatpak apps. To enable it, run:</p>{" "}
      <CodeCopy
        text={`      flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo\n    `}
      />{" "}
    </li>{" "}
    <li>
      {" "}
      <h2>Restart</h2>{" "}
      <p>
        To complete setup, restart your system. Now all you have to do is{" "}
        <a href="https://flathub.org/">install some apps</a>!
      </p>{" "}
    </li>
  </ol>
)
distroMap.set("Debian", <Debian />)

export const Rocky_Linux = () => (
  <ol className="distrotut">
    {" "}
    <li>
      {" "}
      <h2>Install Flatpak</h2>{" "}
      <p>
        Flatpak is installed by default on Rocky Linux 8 and newer, when
        installed with a software selection that includes GNOME (Server with
        GUI, Workstation). If you are using such a system, you may skip this
        step. To install Flatpak on Rocky Linux, run the following in a
        terminal:
      </p>{" "}
      <CodeCopy text={`sudo dnf install flatpak`} />{" "}
    </li>{" "}
    <li>
      {" "}
      <h2>Add the Flathub repository</h2>{" "}
      <p>
        Flathub is the best way to get Flatpak apps. To enable it, download and
        install the{" "}
        <a
          className="btn btn-default"
          href="https://dl.flathub.org/repo/flathub.flatpakrepo"
        >
          Flathub repository file
        </a>
        , or run the following in a terminal:
      </p>{" "}
      <CodeCopy
        text={`      flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo\n    `}
      />{" "}
    </li>{" "}
    <li>
      {" "}
      <h2>Restart</h2>{" "}
      <p>
        To complete setup, restart your system. Now all you have to do is{" "}
        <a href="https://flathub.org/">install some apps</a>!
      </p>{" "}
    </li>
  </ol>
)
distroMap.set("Rocky Linux", <Rocky_Linux />)

export const CentOS = () => (
  <ol className="distrotut">
    {" "}
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
    {" "}
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
    {" "}
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
    {" "}
    <li>
      {" "}
      <h2>Install Flatpak</h2>{" "}
      <p>
        To install Flatpak, enable the ~amd64 keyword for sys-apps/flatpak,
        acct-user/flatpak and acct-group/flatpak:
      </p>{" "}
      <CodeCopy
        text={`      echo -e \'sys-apps/flatpak ~amd64\\nacct-user/flatpak ~amd64\\nacct-group/flatpak ~amd64\\ndev-util/ostree ~amd64\' >> /etc/portage/package.accept_keywords/flatpak\n    `}
      />{" "}
      <p>Then, install Flatpak:</p>{" "}
      <CodeCopy text={`emerge sys-apps/flatpak`} />{" "}
    </li>{" "}
    <li>
      {" "}
      <h2>Add the Flathub repository</h2>{" "}
      <p>Flathub is the best place to get Flatpak apps. To enable it, run:</p>{" "}
      <CodeCopy
        text={`      flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo\n    `}
      />{" "}
    </li>{" "}
    <li>
      {" "}
      <h2>Restart</h2>{" "}
      <p>
        To complete setup, restart your system. Now all you have to do is{" "}
        <a href="https://flathub.org/">install some apps</a>!
      </p>{" "}
      <p>
        Note: graphical installation of Flatpak apps may not be possible with
        Gentoo.
      </p>{" "}
    </li>
  </ol>
)
distroMap.set("Gentoo", <Gentoo />)

export const Kubuntu = () => (
  <ol className="distrotut">
    {" "}
    <li>
      {" "}
      <h2>Install Flatpak</h2>{" "}
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
        text={`      sudo add-apt-repository ppa:alexlarsson/flatpak\n      sudo apt update\n      sudo apt install flatpak\n    `}
      />{" "}
    </li>{" "}
    <li>
      {" "}
      <h2>Install the Discover Flatpak backend</h2>{" "}
      <p>
        The Flatpak plugin for the Software app makes it possible to install
        apps without needing the command line (available on Kubuntu 18.04 and
        newer). To install on 20.04 or later, run:
      </p>{" "}
      <CodeCopy
        text={`      sudo apt install plasma-discover-backend-flatpak\n    `}
      />{" "}
      <p>On Kubuntu 18.04, you should run this instead:</p>{" "}
      <CodeCopy
        text={`      sudo apt install plasma-discover-flatpak-backend\n    `}
      />{" "}
    </li>{" "}
    <li>
      {" "}
      <h2>Add the Flathub repository</h2>{" "}
      <p>Flathub is the best place to get Flatpak apps. To enable it, run:</p>{" "}
      <CodeCopy
        text={`      flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo\n    `}
      />{" "}
    </li>{" "}
    <li>
      {" "}
      <h2>Restart</h2>{" "}
      <p>
        To complete setup, restart your system. Now all you have to do is{" "}
        <a href="https://flathub.org/">install some apps</a>!
      </p>{" "}
    </li>
  </ol>
)
distroMap.set("Kubuntu", <Kubuntu />)

export const Solus = () => (
  <ol className="distrotut">
    {" "}
    <li>
      {" "}
      <h2>Install Flatpak</h2>{" "}
      <p>To install Flatpak, run the following in a terminal:</p>{" "}
      <CodeCopy text={`      sudo eopkg install flatpak\n    `} />{" "}
    </li>{" "}
    <li>
      {" "}
      <h2>Add the Flathub repository</h2>{" "}
      <p>Flathub is the best place to get Flatpak apps. To enable it, run:</p>{" "}
      <CodeCopy
        text={`      flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo\n    `}
      />{" "}
    </li>{" "}
    <li>
      {" "}
      <h2>Restart</h2>{" "}
      <p>
        To complete setup, restart your system. Now all you have to do is{" "}
        <a href="https://flathub.org/">install some apps</a>!
      </p>{" "}
      <p>
        Note: graphical installation of Flatpak apps is not yet possible with
        Solus, but will be available in the near future.
      </p>{" "}
    </li>
  </ol>
)
distroMap.set("Solus", <Solus />)

export const Alpine = () => (
  <ol className="distrotut">
    {" "}
    <li>
      {" "}
      <h2>Install Flatpak</h2>{" "}
      <p>
        Flatpak can be installed from the community repository. Run the
        following in a terminal:
      </p>{" "}
      <CodeCopy text={`      doas apk add flatpak\n    `} />{" "}
    </li>{" "}
    <li>
      {" "}
      <h2>Install the Software Flatpak plugin</h2>{" "}
      <p>
        You can install the Flatpak plugin for either the GNOME Software (since
        v3.13) or KDE Discover (since v3.11), making it possible to install apps
        without needing the command line. To install, for GNOME Software run:
      </p>{" "}
      <CodeCopy
        text={`      doas apk add gnome-software-plugin-flatpak\n    `}
      />{" "}
      <p>And for KDE Discover, run this instead:</p>{" "}
      <CodeCopy text={`      doas apk add discover-backend-flatpak\n    `} />{" "}
    </li>{" "}
    <li>
      {" "}
      <h2>Add the Flathub repository</h2>{" "}
      <p>Flathub is the best place to get Flatpak apps. To enable it, run:</p>{" "}
      <CodeCopy
        text={`      flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo\n    `}
      />{" "}
    </li>{" "}
    <li>
      {" "}
      <h2>Restart</h2>{" "}
      <p>
        To complete the setup, restart your system. Now all you have to do is{" "}
        <a href="https://flathub.org/">install some apps</a>!
      </p>{" "}
    </li>
  </ol>
)
distroMap.set("Alpine", <Alpine />)

export const Mageia = () => (
  <ol className="distrotut">
    {" "}
    <li>
      {" "}
      <h2>Install Flatpak</h2>{" "}
      <p>
        A flatpak package is available for Mageia 6 and newer. To install with
        DNF, run the following as root:
      </p>{" "}
      <CodeCopy text={`      dnf install flatpak\n    `} />{" "}
      <p>
        Or, to install with <code>urpmi</code>, run:
      </p>{" "}
      <CodeCopy text={`      urpmi flatpak\n    `} />{" "}
    </li>{" "}
    <li>
      {" "}
      <h2>Add the Flathub repository</h2>{" "}
      <p>Flathub is the best place to get Flatpak apps. To enable it, run:</p>{" "}
      <CodeCopy
        text={`      flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo\n    `}
      />{" "}
    </li>{" "}
    <li>
      {" "}
      <h2>Restart</h2>{" "}
      <p>
        To complete setup, restart your system. Now all you have to do is{" "}
        <a href="https://flathub.org/">install some apps</a>!
      </p>{" "}
      <p>
        Note: graphical installation of Flatpak apps may not be possible with
        Mageia.
      </p>{" "}
    </li>
  </ol>
)
distroMap.set("Mageia", <Mageia />)

export const Pop_OS = () => (
  <ol className="distrotut">
    {" "}
    <h2>
      Pop!_OS 20.04 has Flatpak installed and Flathub configured by default. The
      Pop!_Shop can be used to install flatpaks.
    </h2>{" "}
    <p>For older versions of Pop!_OS, see the instructions below.</p>{" "}
    <li>
      {" "}
      <h2>Install Flatpak</h2>{" "}
      <p>To install Flatpak on Pop!_OS 19.10 and earlier, simply run:</p>{" "}
      <CodeCopy text={`      sudo apt install flatpak\n    `} />{" "}
    </li>{" "}
    <li>
      {" "}
      <h2>Add the Flathub repository</h2>{" "}
      <p>Flathub is the best place to get Flatpak apps. To enable it, run:</p>{" "}
      <CodeCopy
        text={`      flatpak remote-add --user --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo\n    `}
      />{" "}
    </li>{" "}
    <li>
      {" "}
      <h2>Restart</h2>{" "}
      <p>
        To complete setup, restart your system. Now all you have to do is{" "}
        <a href="https://flathub.org/">install some apps</a>!
      </p>{" "}
      <p>
        Note: graphical installation of Flatpak apps may not be possible with
        Pop!_OS 19.10 and earlier.
      </p>{" "}
    </li>
  </ol>
)
distroMap.set("Pop!_OS", <Pop_OS />)

export const Elementary_OS = () => (
  <ol className="distrotut">
    {" "}
    {/*  As of elementary OS 5.1 up-to-date Flatpak is installed, AppCenter supports it ootb, and Sideload handles .flatpakref files  */}{" "}
    <li>
      {" "}
      <h2>Install Some Apps</h2>{" "}
      {/*  Curated apps in elementary OS will move to Flatpak by default, but Flathub is not included  */}{" "}
      {/*  However, the Flathub remote will be added automatically when installing a Flathub app for the first time with Sideload  */}{" "}
      <p>
        elementary OS 5.1 and newer comes with Flatpak support out of the box.
        For non-curated apps, head to <a href="https://flathub.org/">Flathub</a>{" "}
        to install any app using the big "Install" button, and open the
        downloaded `.flatpakref` file with Sideload.
      </p>{" "}
      <p>
        Note: After installing one app from a remote like Flathub, all other
        apps from that remote will also automatically show up in AppCenter.
      </p>{" "}
    </li>
  </ol>
)
distroMap.set("elementary OS", <Elementary_OS />)

export const Raspberry_Pi_OS = () => (
  <ol className="distrotut">
    {" "}
    <li>
      {" "}
      <h2>Install Flatpak</h2>{" "}
      <p>
        A flatpak package is available in Raspberry Pi OS (previously called
        Raspbian) Stretch and newer. To install it, run the following as root:
      </p>{" "}
      <CodeCopy text={`      apt install flatpak\n    `} />{" "}
    </li>{" "}
    <li>
      {" "}
      <h2>Add the Flathub repository</h2>{" "}
      <p>Flathub is the best place to get Flatpak apps. To enable it, run:</p>{" "}
      <CodeCopy
        text={`      flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo\n    `}
      />{" "}
      <p>
        <b>Important note:</b> As of March 2021, Raspberry Pi computers still
        ship with the 32-bit version of Raspberry Pi OS. However Flathub started
        phasing out support for that architecture. If you consider Flathub as an
        important source of applications, it is recommended to use Raspberry Pi
        OS 64-bit as newer applications are more likely to be available for that
        platform.
      </p>{" "}
    </li>{" "}
    <li>
      {" "}
      <h2>Restart</h2>{" "}
      <p>
        To complete setup, restart your system. Now all you have to do is{" "}
        <a href="https://flathub.org/">install some apps</a>!
      </p>{" "}
      <p>
        Note: graphical installation of Flatpak apps may not be possible with
        Raspberry Pi OS.
      </p>{" "}
    </li>
  </ol>
)
distroMap.set("Raspberry Pi OS", <Raspberry_Pi_OS />)

export const Clear_Linux = () => (
  <ol className="distrotut">
    {" "}
    <p>
      Flatpak is installed and Flathub repository is pre-configured by default
      on Clear Linux when installing the desktop bundle.
    </p>{" "}
    <CodeCopy text={`    sudo swupd bundle-add desktop\n  `} />{" "}
    <p>
      Now all you have to do is{" "}
      <a href="https://flathub.org/">install some apps</a>!
    </p>
  </ol>
)
distroMap.set("Clear Linux", <Clear_Linux />)

export const Void_Linux = () => (
  <ol className="distrotut">
    {" "}
    <li>
      {" "}
      <h2>Install Flatpak</h2> <p>To install Flatpak, run the following:</p>{" "}
      <CodeCopy text={`      sudo xbps-install -S flatpak\n    `} />{" "}
    </li>{" "}
    <li>
      {" "}
      <h2>Add the Flathub repository</h2>{" "}
      <p>Flathub is the best place to get Flatpak apps. To enable it, run:</p>{" "}
      <CodeCopy
        text={`      flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo\n    `}
      />{" "}
    </li>{" "}
    <li>
      {" "}
      <h2>Restart</h2>{" "}
      <p>
        To complete setup, restart your system. Now all you have to do is{" "}
        <a href="https://flathub.org/">install some apps</a>!
      </p>{" "}
    </li>
  </ol>
)
distroMap.set("Void Linux", <Void_Linux />)

export const NixOS = () => (
  <ol className="distrotut">
    {" "}
    <li>
      {" "}
      <h2>Install Flatpak</h2>{" "}
      <p>
        {" "}
        To install Flatpak, set NixOS option{" "}
        <code>services.flatpak.enable</code> to <code>true</code> by putting the
        following into your <code>/etc/nixos/configuration.nix</code>:{" "}
      </p>{" "}
      <CodeCopy text={`      services.flatpak.enable = true;\n    `} />{" "}
      <p>Then, rebuild and switch to the new configuration with:</p>{" "}
      <CodeCopy text={`      sudo nixos-rebuild switch\n    `} />{" "}
      <p>
        For more details see the{" "}
        <a href="https://nixos.org/manual/nixos/stable/index.html#module-services-flatpak">
          NixOS documentation
        </a>
        .
      </p>{" "}
    </li>{" "}
    <li>
      {" "}
      <h2>Add the Flathub repository</h2>{" "}
      <p>Flathub is the best place to get Flatpak apps. To enable it, run:</p>{" "}
      <CodeCopy
        text={`      flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo\n    `}
      />{" "}
    </li>{" "}
    <li>
      {" "}
      <h2>Ready to go!</h2>{" "}
      <p>
        Now all you have to do is{" "}
        <a href="https://flathub.org/">install some apps</a>!
      </p>{" "}
    </li>
  </ol>
)
distroMap.set("NixOS", <NixOS />)

export const PureOS = () => (
  <ol className="distrotut">
    {" "}
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
    {" "}
    <li>
      {" "}
      <h2>Install Flatpak</h2>{" "}
      <p>
        To install Flatpak on Turkman Linux, run the following in a terminal:
      </p>{" "}
      <p>Emerge way</p>{" "}
      <CodeCopy
        text={`      ymp install build-base --no-emerge\n      ymp install flatpak\n    `}
      />{" "}
      <p>No emerge way</p>{" "}
      <CodeCopy text={`      ymp install flatpak --no-emerge\n    `} />{" "}
    </li>{" "}
    <li>
      {" "}
      <h2>Enable services</h2>{" "}
      <p>
        To enable services on Turkman Linux, run the following in a terminal:
      </p>{" "}
      <CodeCopy
        text={`      rc-service add devfs\n      rc-service add fuse\n      rc-service add hostname\n    `}
      />{" "}
    </li>{" "}
    <li>
      {" "}
      <h2>Add the Flathub repository</h2>{" "}
      <p>Flathub is the best place to get Flatpak apps. To enable it, run:</p>{" "}
      <CodeCopy
        text={`       flatpak --user remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo\n    `}
      />{" "}
    </li>{" "}
    <li>
      {" "}
      <h2>Restart</h2>{" "}
      <p>
        To complete setup, restart your system. Now all you have to do is{" "}
        <a href="https://flathub.org/">install some apps</a>!
      </p>{" "}
      <p>
        Note: graphical installation of Flatpak apps may not be possible with
        Turkman Linux.
      </p>{" "}
    </li>
  </ol>
)
distroMap.set("Turkman Linux", <Turkman_Linux />)

export const Ataraxia_Linux = () => (
  <ol className="distrotut">
    {" "}
    <li>
      {" "}
      <h2>Install Flatpak</h2> <p>To install Flatpak, run the following:</p>{" "}
      <CodeCopy text={`      sudo neko em flatpak\n    `} />{" "}
    </li>{" "}
    <li>
      {" "}
      <h2>Add the Flathub repository</h2>{" "}
      <p>Flathub is the best place to get Flatpak apps. To enable it, run:</p>{" "}
      <CodeCopy
        text={`      flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo\n    `}
      />{" "}
    </li>{" "}
    <li>
      {" "}
      <h2>Restart</h2>{" "}
      <p>
        To complete setup, restart your system. Now all you have to do is{" "}
        <a href="https://flathub.org/">install some apps</a>!
      </p>{" "}
    </li>
  </ol>
)
distroMap.set("Ataraxia Linux", <Ataraxia_Linux />)

export const Zorin_OS = () => (
  <ol className="distrotut">
    {" "}
    <h2>
      Flatpak is installed by default on Zorin OS. You can use the Software
      Store app to download flatpak apps.
    </h2>
  </ol>
)
distroMap.set("Zorin OS", <Zorin_OS />)

export const Deepin = () => (
  <ol className="distrotut">
    {" "}
    <li>
      {" "}
      <h2>Install Flatpak</h2> <p>To install Flatpak, run the following:</p>{" "}
      <CodeCopy text={`      sudo apt install flatpak\n    `} />{" "}
    </li>{" "}
    <li>
      {" "}
      <h2>Add the Flathub repository</h2>{" "}
      <p>Flathub is the best place to get Flatpak apps. To enable it, run:</p>{" "}
      <CodeCopy
        text={`      flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo\n    `}
      />{" "}
    </li>{" "}
    <li>
      {" "}
      <h2>Install the Deepin themes</h2>{" "}
      <p>To install light and dark themes, run:</p>{" "}
      <CodeCopy
        text={`      flatpak install flathub org.gtk.Gtk3theme.deepin\n      flatpak install flathub org.gtk.Gtk3theme.deepin-dark\n    `}
      />{" "}
    </li>{" "}
    <li>
      {" "}
      <h2>Restart</h2>{" "}
      <p>
        To complete setup, restart your system. Now all you have to do is{" "}
        <a href="https://flathub.org/">install some apps</a>!
      </p>{" "}
    </li>
  </ol>
)
distroMap.set("Deepin", <Deepin />)

export const Pardus = () => (
  <ol className="distrotut">
    {" "}
    <li>
      {" "}
      <h2>Install Flatpak</h2>{" "}
      <p>
        A flatpak package is available in Pardus 2019 and newer. To install it,
        run the following as root:
      </p>{" "}
      <CodeCopy text={`      apt install flatpak\n    `} />{" "}
      <p>
        For Pardus 2017 and older versions, a flatpak package is available in
        the{" "}
        <a href="https://backports.debian.org/Instructions/">
          official backports repository
        </a>
        .{" "}
      </p>{" "}
    </li>{" "}
    <li>
      {" "}
      <h2>Install the Software Flatpak plugin</h2>{" "}
      <p>
        If you are running GNOME, it is also a good idea to install the Flatpak
        plugin for GNOME Software. To do this, run:
      </p>{" "}
      <CodeCopy
        text={`      apt install gnome-software-plugin-flatpak\n    `}
      />{" "}
    </li>{" "}
    <li>
      {" "}
      <h2>Add the Flathub repository</h2>{" "}
      <p>Flathub is the best place to get Flatpak apps. To enable it, run:</p>{" "}
      <CodeCopy
        text={`      flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo\n    `}
      />{" "}
    </li>{" "}
    <li>
      {" "}
      <h2>Restart</h2>{" "}
      <p>
        To complete setup, restart your system. Now all you have to do is{" "}
        <a href="https://flathub.org/">install some apps</a>!
      </p>{" "}
    </li>
  </ol>
)
distroMap.set("Pardus", <Pardus />)

export const MX_Linux = () => (
  <ol className="distrotut">
    {" "}
    <li>
      {" "}
      <h2>Enable Flatpak through the Software Manager</h2>{" "}
      <p>
        Flatpak support is built in from MX 18 and later. It is only required to
        activate the Flathub repository following these instructions:
      </p>{" "}
      <p>
        Open <strong>MX Package Installer</strong> (open the menu and look in MX
        Tools), select the "Flatpaks" tab, to activate the repository you will
        need to enter the root password.
      </p>{" "}
    </li>{" "}
    <li>
      {" "}
      <h2>Restart</h2>{" "}
      <p>
        To complete setup, restart your system. Now all you have to do is{" "}
        <a href="https://flathub.org/">install some apps</a>!
      </p>{" "}
    </li>
  </ol>
)
distroMap.set("MX Linux", <MX_Linux />)

export const Pisi_GNULinux = () => (
  <ol className="distrotut">
    {" "}
    <li>
      {" "}
      <h2>Install Flatpak</h2>{" "}
      <p>
        A flatpak package is available in Pisi 2.1 and newer. To install it, run
        the following as root:
      </p>{" "}
      <CodeCopy text={`      sudo pisi it flatpak\n    `} />{" "}
    </li>{" "}
    <li>
      {" "}
      <h2>Add the Flathub repository</h2>{" "}
      <p>Flathub is the best place to get Flatpak apps. To enable it, run:</p>{" "}
      <CodeCopy
        text={`      flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo\n    `}
      />{" "}
    </li>{" "}
    <li>
      {" "}
      <h2>Restart</h2>{" "}
      <p>
        To complete setup, restart your system. Now all you have to do is{" "}
        <a href="https://flathub.org/">install some apps</a>!
      </p>{" "}
      <p>
        Note: for now, graphical installation of Flatpak apps is not possible on
        Pisi GNU/Linux.
      </p>{" "}
    </li>
  </ol>
)
distroMap.set("Pisi GNULinux", <Pisi_GNULinux />)

export const EndeavourOS = () => (
  <ol className="distrotut">
    {" "}
    <li>
      {" "}
      <h2>Install Flatpak</h2>{" "}
      <p>
        To install Flatpak on EndeavorOS, you must first make sure your
        installation is up to date, run the following in a terminal:
      </p>{" "}
      <CodeCopy text={`      sudo pacman -Syu\n    `} />{" "}
      <p>Then install Flatpak:</p>{" "}
      <CodeCopy text={`      sudo pacman -S flatpak\n    `} />{" "}
    </li>{" "}
    <li>
      {" "}
      <h2>Add the Flathub repository</h2>{" "}
      <p>Flathub is the best place to get Flatpak apps. To enable it, run:</p>{" "}
      <CodeCopy
        text={`      flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo\n    `}
      />{" "}
    </li>{" "}
    <li>
      {" "}
      <h2>Restart</h2>{" "}
      <p>
        To complete setup, restart your system. Now all you have to do is{" "}
        <a href="https://flathub.org/">install some apps</a>!
      </p>{" "}
      <p>
        Note: graphical installation of Flatpak apps may not be possible with
        EndeavourOS.
      </p>{" "}
    </li>
  </ol>
)
distroMap.set("EndeavourOS", <EndeavourOS />)

export const KDE_neon = () => (
  <ol className="distrotut">
    {" "}
    <h2>Enable Flatpak through the Software Manager</h2>{" "}
    <p>
      Flatpak support is built in by default from KDE neon 19 and later. To
      activate the <a href="https://flathub.org/">Flathub</a> repository in
      Discover, just follow the instructions below:
    </p>{" "}
    <p>Open Discover and click on Settings (lower left corner).</p>{" "}
    <p>Check that in the Flatpak section the box is checked.</p>{" "}
    <p>
      Note: with this Flathub app search will be integrated in Discover, if you
      want to limit the app search to Flathub you can mark Flatpak as default by
      clicking on the star.
    </p>
  </ol>
)
distroMap.set("KDE neon", <KDE_neon />)

export const GNU_Guix = () => (
  <ol className="distrotut">
    {" "}
    <li>
      {" "}
      <h2>Install Flatpak</h2>{" "}
      <p>
        Flatpak can be installed from GNU Guix\'s default repositories. Run the
        following in a terminal:
      </p>{" "}
      <CodeCopy text={`      guix install flatpak\n    `} />{" "}
    </li>{" "}
    <li>
      {" "}
      <h2>Add the Flathub repository</h2>{" "}
      <p>Flathub is the best place to get Flatpak apps. To enable it, run:</p>{" "}
      <CodeCopy
        text={`      flatpak --user remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo\n    `}
      />{" "}
    </li>{" "}
    <li>
      {" "}
      <h2>Restart</h2>{" "}
      <p>
        To complete setup, restart your system. Now all you have to do is{" "}
        <a href="https://flathub.org/">install some apps</a>!
      </p>{" "}
      <p>
        Note: graphical installation of Flatpak apps may not be possible with
        GNU Guix.
      </p>{" "}
    </li>
  </ol>
)
distroMap.set("GNU Guix", <GNU_Guix />)

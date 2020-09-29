import { useState, useEffect } from 'react'

export default function Application() {

    //const { id } = useParams()
    const [app, setApp] = useState(null)
    /*
    useEffect(() => {
        async function fetchApp() {
            const response = await fetch(`http://localhost:9090/api/v2/apps/${id}`, {
                mod: 'cors',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json'
                }
            })
            try {
                const j = await response.json()
                setApp(j)
            } catch (e) {
            }
        }
        fetchApp()
    }, [id])
    */
    return app !== null ? <div id="application">

        <header>
            {app.type === 'desktop-application' && (
                <div className="app-logo">
                    <img src={`https://flathub.org//repo/appstream/x86_64/icons/128x128/${app.id}.png`} alt="Logo" />
                </div>
            )}
            <aside>
                <h2>{app.name[0].default}</h2>
                <p>{app.summary[0].default}</p>
                <button>Install</button><br />
                <small>Make sure to follow the <a href="https://flatpak.org/setup/">setup guide</a> before installing</small>
            </aside>
        </header>
        { /*app.screenshots.length > 0 && (
           <Carousel carouselId="screeshots"
                images={app.screenshots.map((s) => s.image[0].source.url)}
                options={{
                    dist: -50,
                    duration: 200,
                    fullWidth: true,
                    indicators: true,
                    noWrap: false,
                    numVisible: 1,
                    onCycleTo: null,
                    padding: 0,
                    shift: 0
                }}
            />)*/}
        <hr />

        <div className="app-urls">
            {/*app.url.map((u) => {
                if (u.BugTracker) {
                    return <Button style={{ marginRight: '12px' }}>Issues</Button>
                } else if (u.Translate) {
                    return <Button style={{ marginRight: '12px' }}>Translations</Button>
                } else if (u.Homepage) {
                    return <Button style={{ marginRight: '12px' }}>Homepage</Button>
                } else if (u.Donation) {
                    return <Button style={{ marginRight: '12px' }}>Donation</Button>
                }
            })*/}
        </div>



        <h3>Additional information</h3>

        <div className="row app-info">
            <div className="col s4">
                <div className="app-info-item">
                    <div className="app-info-title">
                        Updated
                    </div>
                    <div className="app-info-value">

                    </div>
                </div>
            </div>
            <div className="col s4">
                <div className="app-info-item">
                    <div className="app-info-title">
                        Version
                    </div>
                    <div className="app-info-value">
                        {app.releases.length > 0 && app.releases[0].version}
                    </div>
                </div></div>
            <div className="col s4">
                <div className="app-info-item">
                    <div className="app-info-title">
                        Category
                    </div>
                    <div className="app-info-value">
                        {app.categories.join(", ")}
                    </div>
                </div></div>
            <div className="col s4">
                <div className="app-info-item">
                    <div className="app-info-title">
                        License
                    </div>
                    <div className="app-info-value">
                        {app.project_license}
                    </div>
                </div></div>
            <div className="col s4">
                <div className="app-info-item">
                    <div className="app-info-title">
                        Developer
                    </div>
                    <div className="app-info-value">
                        {app.developer_name && app.developer_name[0].default}
                    </div>
                </div></div>
            <div className="col s4">
                <div className="app-info-item">
                    <div className="app-info-title">
                        Publisher
                    </div>
                    <div className="app-info-value">

                    </div>
                </div></div>
        </div>

        <hr />
        <h3>Command line instructions</h3>
        <h5>Install:</h5>
        <small>Make sure to follow the <a href="https://flatpak.org/setup/">setup guide</a> before installing</small>
        <pre>flatpak install flathub {app.id}</pre>
        <h5>Run:</h5>
        <pre>flatpak run {app.id}</pre>
    </div> : <>Loading</>
}
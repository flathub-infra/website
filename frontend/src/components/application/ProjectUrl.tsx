import ProjectUrl from './../../types/ProjectUrl'



export default function ProjectUrlWidget({ url, type }) {
  let label = ""
  let icon = ""
  switch (type) {
    case ProjectUrl.Homepage:
      label = "Project Website"
      icon = "website"
      break
    case ProjectUrl.Donate:
      label = "Donate"
      icon = "donate"
      break
    case ProjectUrl.Bugtracker:
      label = "Report an Issue"
      icon = "bugtracker"
      break
    case ProjectUrl.Translate:
      label = "Contribute translations"
      icon = "translations"
      break
  }

  return <div className="url">
    <div className="icon">
      <img src={`/img/${icon}.svg`} />
    </div>
    <div className="details">
      {label} <br />
      <a href={url}>{url}</a>
    </div>
    <div className="external-link ">
    <a href={url}><img src="/img/external-link.svg" /></a>
    </div>
  </div>


}

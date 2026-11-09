import { createTranslator } from "next-intl"

export const checkerHealthText = createTranslator({
  locale: "en",
  messages: {
    title: "Update check health",
    coverage:
      "Reports cover one of six repository shards every four hours, plus extra-data apps. Reports are imported every four hours. Missing reports mean unknown. Artifacts do not list every selected or skipped repository. Some branch reports explain runtime-related skips.",
    "unknown-location": "Source location unknown",
    "document-root": "Document root",
    "runtime-eol-skip": "Skipped because a parent runtime is end of life.",
    "runtime-replacement": "Replacement runtime: {ref}",
    loading: "Loading update check health",
    unavailable:
      "We couldn’t load the stored reports. Reload to try again. This does not mean the update checker failed.",
    unknown:
      "No update check report has been imported for this app. Its checker health is unknown.",
    "last-report": "Last report",
    "last-check": "Last checker execution",
    "last-failure-time": "Last failure: {date}",
    "unknown-check": "Unknown",
    "default-branch": "Default branch",
    semantics:
      "Each source shows its last observation, which may be older than the latest report. Checked means current according to the configured checker, not necessarily the newest upstream release. Only a successful source observation clears its failure history.",
    "status-checked": "Checked",
    "status-unchecked": "Unchecked",
    "status-failed": "Checker failure",
    "status-unresolved": "Unresolved failure",
    "status-recovered": "Recovered",
    "status-blocked": "Policy-blocked update",
    "status-update_available": "Update available",
    failures:
      "{count, plural, one {Failed on # observed check. No recovery recorded.} other {Failed on # observed checks. No recovery recorded.}}",
    recovered: "Checker recovered on {date}",
    observed: "Observed {date}: view run logs",
    "source-evidence": "Raw source evidence",
    "source-details": "Source details",
    "observed-time": "Observed {date}",
    "unchecked-note":
      "Generated dependencies without an update checker are not failures. Older rotating-URL and Snapcraft reports can say unchecked/no_candidate after unchanged checks; these remain unknown.",
    diagnostics: "Report-level errors",
    "diagnostics-note":
      "These are historical report errors, not an app failure verdict. Missing files may belong to intentionally uninitialized submodules, but these reports do not identify exclusions. Runtime branches can behave differently. Missing later errors alone do not prove recovery.",
    "diagnostic-count":
      "{count, plural, one {Seen in # report} other {Seen in # reports}}",
    history: "Recent reports",
    "delivery-note":
      "Showing up to 20 reports, retained after GitHub artifacts expire. “Pull request handled” can mean an existing open or closed pull request was found. It does not prove a new pull request was opened or an update merged.",
    "about-reports": "What these reports tell you",
    "observation-note":
      "Sources may have older observations. Missing or unchecked results remain unknown.",
    "unknown-next-step":
      "This app may not have been included in a recent run, or its report may not have been imported yet. Check the workflow runs for more information.",
    "browse-runs": "Browse workflow runs",
    "latest-run": "View latest run",
    reload: "Reload reports",
    sources: "Source results",
    "source-count": "{shown, number} of {total, number} sources",
    "find-source": "Find a source",
    "search-placeholder": "Module, manifest or branch",
    "filter-status": "Show results",
    "filter-all": "All sources",
    "filter-failures": "Unresolved failures",
    "filter-updates": "Available or blocked updates",
    "filter-recovered": "Recovered",
    "filter-checked": "Checked",
    "filter-unchecked": "Unchecked",
    "no-matches": "No sources match these filters.",
    "clear-filters": "Clear filters",
    "show-more": "Show {count, number} more sources",
    "no-sources":
      "This report contains no source observations. Inspect the report-level errors or open the latest run.",
    location: "Source location",
    "observed-label": "Last observed",
    "latest-result": "Latest source result",
    checker: "Checker",
    "selected-version": "Selected version",
    "run-logs": "View run logs",
    "failure-logs": "View failed run",
    "latest-source-logs": "View latest observation",
    "unresolved-note":
      "The latest observation did not establish recovery. The earlier failure remains unresolved.",
    "blocked-note":
      "An update was found, but the configured update policy prevented it from being applied.",
    "reason-no_update_checker":
      "No update checker is configured for this source.",
    "reason-no_applicable_checker":
      "No applicable checker ran for this source.",
    "reason-no_candidate":
      "The checker reported no candidate. This report does not establish that the source is current.",
    "reason-update_policy":
      "Review the source’s update policy in the packaging manifest.",
    "report-completed": "Completed",
    "report-failed": "Failed",
    "report-skipped": "Skipped",
    "delivery-pr_handled": "Pull request handled",
    "delivery-no_changes": "No changes",
    "delivery-failed": "Delivery failed",
    "delivery-pending": "Delivery pending",
  } as Record<string, string>,
})

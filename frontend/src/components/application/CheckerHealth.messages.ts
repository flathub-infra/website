import { createTranslator } from "next-intl"

export const checkerHealthText = createTranslator({
  locale: "en",
  messages: {
    title: "Update check health",
    "selection-title": "Latest update check",
    "selection-open-run": "View check logs",
    "selection-summary-results": "Update check results are available",
    "selection-summary-results-note":
      "See the source results below for updates or problems. A finished check does not mean every source is up to date.",
    "selection-summary-problem": "The update check reported a problem",
    "selection-summary-problem-note":
      "Some checks may not have finished. Review the results below or open the check logs to find out what happened.",
    "selection-summary-unreadable": "We couldn’t read the update check results",
    "selection-summary-unreadable-note":
      "The checker produced results that we can’t read. We can’t tell from them whether this app is up to date. Check the logs for more information.",
    "selection-summary-no-results": "No results are available for this check",
    "selection-summary-no-results-note":
      "This app was chosen for checking, but we don’t have usable results from that run. Check the logs to see whether it finished.",
    "selection-summary-waiting": "Waiting for update check results",
    "selection-summary-waiting-note":
      "This app was chosen for checking. The check may still be running, or its results may not have arrived yet.",
    "selection-summary-skipped": "This app’s update check was skipped",
    "selection-summary-skipped-note":
      "This run skipped the check. Open the check logs to see why.",
    "selection-summary-not-started": "The update check couldn’t start",
    "selection-summary-not-started-note":
      "A problem preparing this app prevented the check from starting. Open the check logs for details.",
    "selection-summary-unknown": "We can’t confirm this app’s latest check",
    "selection-summary-unknown-note":
      "The available records don’t establish what happened. This doesn’t mean the app is up to date or was skipped.",
    "selection-exit-report-note":
      "Exit 0 describes the process, not the completeness of its checks.",
    "selection-shard-progress": "{received}/{expected} shards",
    "selection-complete": "Inventory complete",
    "selection-incomplete": "Inventory incomplete",
    "selection-unknown": "Inventory unknown",
    "selection-stale": "This information is more than two days old.",
    "selection-decision": "Selection decision",
    "selection-invocation": "Checker invocation",
    "selection-report": "Health report",
    "selection-no-decision":
      "No unambiguous selection decision is available. Missing evidence does not mean it was excluded or healthy.",
    "selection-selected": "Selected",
    "selection-excluded": "Excluded",
    "selection-error": "Selection error",
    "selection-pending": "Pending",
    "selection-no_checker_marker":
      "No automatic update checks were found for this app.",
    "selection-archived": "Archived repository",
    "selection-checker_disabled":
      "Automatic update checks are disabled for this app.",
    "selection-inactive": "Inactive repository",
    "selection-end_of_life": "End of life",
    "selection-manifest_not_found": "Manifest not found",
    "selection-clone_failed":
      "The checker couldn’t download this app’s packaging files. Open the check logs for details.",
    "selection-marker_scan_failed": "Checker marker scan failed",
    "selection-invalid_flathub_json": "Invalid flathub.json",
    "selection-succeeded": "Exited successfully",
    "selection-outdated_only": "Outdated-only exit",
    "selection-failed": "Nonzero failure exit",
    "selection-selection_error": "Selection failed before invocation",
    "selection-not_started": "Not started",
    "selection-exit-code": "Exit code: {code}",
    "selection-report-available": "Imported and checkout matched",
    "selection-report-pending": "Awaiting completion or import",
    "selection-report-not_expected": "Not expected",
    "selection-report-missing": "Selected, but report missing",
    "selection-report-invalid": "Checker produced invalid JSON",
    "selection-report-invalid_or_unsupported": "Report invalid or unsupported",
    "selection-report-artifact_unavailable":
      "Expected report artifact not imported",
    "selection-report-checkout_unverified":
      "Report checkout could not be matched",
    "selection-report-ambiguous": "Conflicting report evidence",
    "selection-report-conflicting_inventory":
      "Report conflicts with selection inventory",
    "selection-report-incomplete": "Run ended before processing completed",
    "selection-selection_unavailable":
      "No selection inventory imported for this run.",
    "selection-missing_shards": "Some selection shards are missing.",
    "selection-duplicate_shards":
      "Multiple artifacts claim the same selection shard.",
    "selection-listing_drift":
      "Repository listings differ. A shared denominator is unavailable.",
    "selection-inconsistent_provenance":
      "Selection shards have conflicting provenance.",
    "selection-processing_incomplete":
      "Repository listing or processing did not complete.",
    "selection-run_in_progress": "Workflow completion has not been confirmed.",
    "selection-duplicate_repositories":
      "A repository appears in multiple selection shards.",
    "selection-missing_decisions": "Some listed repositories have no decision.",
    "selection-pending_decisions":
      "Some selection decisions are still pending.",
    "selection-inventory_error": "Selection exited with an error.",
    "selection-invocation_incomplete":
      "Some selected invocations have no final outcome.",
    "selection-expired": "A selection artifact expired before import.",
    "selection-invalid_or_unsupported":
      "Selection artifact invalid or unsupported.",
    "selection-inventory-details": "Technical details",
    "selection-public_organization": "Public organization inventory",
    "selection-target_request": "Targeted request, not organization-wide",
    "selection-repositories": "Repositories in listing: {count}",
    "selection-provenance": "Raw selection provenance",
    coverage:
      "Selection inventories describe repository decisions and invocation outcomes. Health reports describe checked sources. Missing evidence leaves coverage unknown.",
    "summary-failures":
      "{count, plural, one {# source has an unresolved failure} other {# sources have unresolved failures}}",
    "summary-no-failures": "No unresolved source failures",
    "unknown-location": "Source location unknown",
    "document-root": "Document root",
    "runtime-eol-skip": "Skipped because a parent runtime is end of life.",
    "eol-skip": "Skipped because this checkout is marked end of life.",
    "packaging-checkout": "Packaging checkout before checks",
    "submodule-updates": "Submodule updates",
    "submodule-current": "Current commit",
    "submodule-candidate": "Candidate commit",
    "submodule-files":
      "{count, plural, one {# changed file} other {# changed files}}",
    "unknown-revision": "Revision unknown",
    "checkout-dirty":
      "Local changes present; the commit alone does not identify the checked content.",
    "checkout-clean": "No local changes",
    "checkout-unknown": "Local changes not measured",
    "checker-revision": "Checker revision",
    "checker-source-build": "Container build",
    "checker-source-git": "Local Git checkout",
    "checker-source-unknown": "Checker provenance unknown",
    "pr-created": "Pull request created in this run",
    "pr-existing_open": "Existing open pull request found",
    "pr-existing_closed": "Existing closed pull request found",
    "pr-existing_merged": "Previously merged pull request found",
    "pr-merged": "Pull request merged in this run",
    "pull-request-number": "PR #{number}",
    "view-pull-request": "View pull request",
    "runtime-replacement": "Replacement runtime: {ref}",
    loading: "Loading update check health",
    unavailable:
      "We couldn’t load the stored reports. Reload to try again. This does not mean the update checker failed.",
    unknown:
      "No update check report has been imported for this app. Its checker health is unknown.",
    "last-report": "Last report",
    "last-report-and-check": "Last report and check",
    "current-version": "Current version",
    "version-unknown": "Not recorded",
    "no-checker": "Not configured",
    "last-check": "Last checker execution",
    "last-failure-time": "Last failure: {date}",
    "unknown-check": "Unknown",
    "default-branch": "Default branch",
    semantics:
      'Each source shows its last observation, which may predate the latest report. "Checked" means the configured checker considers the source current. It does not guarantee the latest upstream release. Only a successful observation clears that source\'s failure history.',
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
    "observed-time": "Observed {date}",
    "unchecked-note":
      'Generated dependencies without an update checker are not failures. Older rotating-URL and Snapcraft reports may show "unchecked/no_candidate" when a check found no changes. Their status remains unknown.',
    diagnostics: "Report-level errors",
    "diagnostics-note":
      "These are historical report errors, not an app failure verdict. Missing files may belong to intentionally uninitialized submodules, but these reports do not identify exclusions. Runtime branches can behave differently. Missing later errors alone do not prove recovery.",
    "diagnostic-count":
      "{count, plural, one {Seen in # report} other {Seen in # reports}}",
    history: "Recent reports",
    "delivery-note":
      "Showing up to 20 reports, retained after GitHub artifacts expire. Pull request details show the last confirmed outcome at the time of the run, even if delivery later failed. Older reports only say “Pull request handled”, which does not prove a new pull request was opened or an update merged.",
    "about-reports": "What these reports tell you",
    "observation-note":
      "Sources may have older observations. Missing or unchecked results remain unknown.",
    "unknown-next-step":
      "This app may not have been included in a recent run, or its report may not have been imported yet. Check the workflow runs for more information.",
    "browse-runs": "Browse workflow runs",
    "latest-run": "View latest run",
    reload: "Reload reports",
    sources: "Source results",
    "source-total": "{count, plural, one {# source} other {# sources}}",
    "search-filter": "Search and filter",
    "filters-active": "(active)",
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

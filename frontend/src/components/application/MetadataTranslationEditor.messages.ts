import { createTranslator } from "next-intl"

export const metadataTranslationText = createTranslator({
  locale: "en",
  messages: {
    title: "Translate this listing",
    "last-editor": "Account {id} last saved this text.",
    "text-conflict": "This text changed while you were editing.",
    "current-translation": "Saved translation",
    "your-draft": "Your draft",
    "keep-draft": "Keep editing my draft",
    "use-saved": "Use saved translation",
    "discard-unsaved": "Discard your unsaved edits?",
    "source-changed": "The source text changed",
    recover: "Use current source",
    "pull-request-closed": "The previous pull request is closed",
    restart: "Prepare a new pull request",
    "restart-help":
      "Flathub will send your saved translations in a new pull request at the next run.",
    "recovery-help":
      "Keep translations that still match the source. Review the rest below.",
    "recovery-unsaved": "Using this button keeps your unsaved drafts.",
    "previous-translations": "Saved translations to review",
    "previous-help":
      "Compare these saved copies with the current text. Copy anything you want to keep.",
    "removed-translation": "Translation removed",
    "dismiss-recovered": "Dismiss saved translation",
    "dismiss-recovered-confirm": "Permanently delete this saved copy?",
    intro: "Save or reload to see other translators' changes.",
    language: "Translation language",
    "language-help":
      "Use a language code: de for German, pt_BR for Brazilian Portuguese.",
    load: "Load translations",
    editor: "Listing translation editor",
    preview: "Preview",
    "preview-label": "Preview",
    "language-heading": "{language} translation",
    "translated-count": "{count, number} of {total, number} translated",
    translated: "translated",
    "original-text": "Original text",
    "translation-label": "Translation in {language}",
    "translation-placeholder": "Write in {language}",
    "not-saved": "Not saved",
    untranslated: "Not translated",
    "browse-fields": "Browse texts",
    "field-position": "Text {current, number} of {total, number}",
    "previous-field": "Previous text",
    "next-field": "Next text",
    save: "Save translation",
    "save-next": "Save and next",
    saving: "Saving…",
    skip: "Skip",
    saved: "Translation saved.",
    queued: "Saved changes go to GitHub every three hours.",
    "batch-failed": "Saved, but not sent to GitHub.",
    "view-contribution": "View pull request",
    "automatic-pr-help":
      "You can save one text at a time. Flathub sends saved translations to GitHub every three hours.",
    "no-fields": "This file has no editable text.",
    "saving-unavailable": "You can't save this translation",
    "editing-help":
      "Empty fields use the original text. Clear and save to remove a translation.",
    "markup-help": "Keep markup and code contents unchanged. Write & as &amp;.",
    "keywords-help": "Enter one keyword per line.",
    license: "Translation license: {license}.",
    "license-missing": "not specified",
    "submission-unavailable":
      "Flathub needs GitHub access and a metadata license to save edits. Copy your draft before leaving.",
    "open-repository": "Open repository",
    "error-title": "Translation error",
    fields: {
      summary: "Summary",
      description: "Description",
      name: "Application name",
      name_variant_suffix: "Name variant",
      developer_name: "Developer name",
      keywords: "Keywords",
      caption: "Screenshot caption",
      release: "Release notes",
      agreement: "Agreement",
    } as Record<string, string>,
    errors: {
      source_unavailable:
        "Flathub can no longer edit this listing. You can still copy your saved translations.",
      invalid_characters:
        "Remove invalid control characters from the translation.",
      source_changed:
        "The source or pull request changed. Copy unsaved text before reloading.",
      pull_request_closed:
        "The previous pull request is closed. Prepare a new one to continue.",
      source_locale: "Choose a language other than the source language.",
      invalid_locale: "Enter a language code, such as de or pt_BR.",
      metadata_not_found:
        "No editable listing found. Check the repository for translation instructions.",
      unsupported_metadata:
        "Flathub can't edit this listing. Check the repository for translation instructions.",
      unsupported_repository:
        "This repository does not support translation through Flathub.",
      invalid_metadata: "The source XML is invalid.",
      ambiguous_translations:
        "Flathub can't match the translations to the original text. Check the XML in the repository.",
      invalid_markup:
        "Use valid XML with only em and code markup in paragraphs and list items.",
      changed_code: "Keep code and placeholders unchanged.",
      invalid_keywords: "Enter one unique keyword per line.",
      invalid_units:
        "Some fields no longer match the source. Load the latest translations.",
      no_changes: "Change the translation before saving.",
      missing_license:
        "The metadata needs a license before you can save translations.",
      metadata_too_large: "This file exceeds the editor's size limit.",
      app_not_found: "App not found.",
      submission_unavailable:
        "GitHub publishing is unavailable. Copy unsaved text and try again later.",
      github_unavailable:
        "GitHub is unavailable. Your edits are still here. Try again shortly.",
      not_logged_in: "Sign in to save translations.",
      request_failed: "The request failed. Try again.",
    } as Record<string, string>,
  },
})

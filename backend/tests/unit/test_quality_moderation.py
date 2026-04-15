from app.quality_moderation_checks import (
    summary_doesnt_repeat_app_name,
    summary_doesnt_start_with_article,
)


class TestDontStartWithAnArticle:
    def test_article_a(self):
        assert summary_doesnt_start_with_article("A simple editor") is False

    def test_article_an(self):
        assert summary_doesnt_start_with_article("An image viewer") is False

    def test_article_the(self):
        assert summary_doesnt_start_with_article("The LibreOffice suite") is False

    def test_no_article_verb(self):
        assert summary_doesnt_start_with_article("View images and videos") is True

    def test_no_article_imperative(self):
        assert summary_doesnt_start_with_article("Edit documents") is True

    def test_word_starting_with_an_but_not_article(self):
        assert summary_doesnt_start_with_article("Another tool") is True

    def test_word_starting_with_the_but_not_article(self):
        assert summary_doesnt_start_with_article("Theatre app") is True

    def test_word_starting_with_a_but_not_article(self):
        assert summary_doesnt_start_with_article("Animate your photos") is True

    def test_empty_summary_fails(self):
        assert summary_doesnt_start_with_article("") is False

    def test_single_letter_a_no_space(self):
        assert summary_doesnt_start_with_article("A") is True


class TestDontRepeatAppName:
    def test_name_at_start(self):
        assert (
            summary_doesnt_repeat_app_name(
                "Apostrophe", "Apostrophe - A simple markdown editor"
            )
            is False
        )

    def test_name_at_end(self):
        assert (
            summary_doesnt_repeat_app_name("Firefox", "Browse the web with Firefox")
            is False
        )

    def test_name_in_middle(self):
        assert (
            summary_doesnt_repeat_app_name(
                "Inkscape", "Edit vector graphics with Inkscape"
            )
            is False
        )

    def test_multiword_name(self):
        assert (
            summary_doesnt_repeat_app_name("GNOME Maps", "View GNOME Maps data")
            is False
        )

    def test_name_with_dash_prefix(self):
        assert (
            summary_doesnt_repeat_app_name("Krita", "Krita - Digital Painting") is False
        )

    def test_common_noun_lowercase_not_flagged(self):
        assert summary_doesnt_repeat_app_name("Files", "View files and folders") is True

    def test_common_noun_music_lowercase(self):
        assert (
            summary_doesnt_repeat_app_name("Music", "Play music and podcasts") is True
        )

    def test_common_noun_notes_lowercase(self):
        assert summary_doesnt_repeat_app_name("Notes", "Take notes and sync") is True

    def test_common_noun_calendar_lowercase(self):
        assert (
            summary_doesnt_repeat_app_name("Calendar", "Manage your calendar") is True
        )

    def test_common_noun_clocks_lowercase(self):
        assert (
            summary_doesnt_repeat_app_name("Clocks", "World clocks and alarms") is True
        )

    def test_unrelated_summary(self):
        assert summary_doesnt_repeat_app_name("Fractal", "A Matrix client") is True

    def test_multiword_name_partial_match_passes(self):
        assert (
            summary_doesnt_repeat_app_name("GNOME Maps", "Navigate with maps") is True
        )

    def test_name_not_matched_as_substring(self):
        assert summary_doesnt_repeat_app_name("Ink", "Edit with Inkscape") is True

    def test_name_not_matched_as_prefix_of_word(self):
        assert summary_doesnt_repeat_app_name("Note", "A notebook application") is True

    def test_empty_name_fails(self):
        assert summary_doesnt_repeat_app_name("", "Some summary") is False

    def test_empty_summary_fails(self):
        assert summary_doesnt_repeat_app_name("App", "") is False

    def test_both_empty_fails(self):
        assert summary_doesnt_repeat_app_name("", "") is False

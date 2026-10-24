import unittest
import numpy as np
import pandas as pd

from backend.app.expert_system.sanitizer import sanitize_dataframe


def repairs_for(repairs, rule_id, column=None):
    return [r for r in repairs if r["rule_id"] == rule_id and (column is None or r["column"] == column)]


class TestSanitizerRules(unittest.TestCase):

    def test_repair_dict_shape(self):
        df = pd.DataFrame({"x": ["1", "2", "?", "4", "5"] * 4})
        _, repairs = sanitize_dataframe(df)
        self.assertTrue(repairs)
        for r in repairs:
            self.assertEqual(
                set(r),
                {"rule_id", "rule_name", "column", "severity", "affected_count", "description", "examples", "replay"},
            )
            self.assertIsInstance(r["replay"], dict)
            self.assertIn(r["severity"], {"WARNING", "INFO", "CRITICAL"})
            self.assertLessEqual(len(r["examples"]), 3)
            for ex in r["examples"]:
                self.assertEqual(set(ex), {"before", "after"})

    def test_input_is_not_modified(self):
        df = pd.DataFrame({"x": ["a", "?", "b"] * 5})
        before = df.copy()
        sanitize_dataframe(df)
        pd.testing.assert_frame_equal(df, before)

    # R-QLT-01
    def test_disguised_missing_tokens_become_nan(self):
        df = pd.DataFrame({"city": ["Paris", "?", "Rome", " N/A ", "--", "Paris", "Rome", "Paris", "null", "Rome"]})
        out, repairs = sanitize_dataframe(df)
        self.assertEqual(int(out["city"].isna().sum()), 4)
        self.assertEqual(repairs_for(repairs, "R-QLT-01", "city")[0]["affected_count"], 4)

    def test_unknown_kept_when_it_dominates_the_column(self):
        df = pd.DataFrame({"src": ["unknown"] * 8 + ["web", "app"]})
        out, repairs = sanitize_dataframe(df)
        self.assertEqual(int(out["src"].isna().sum()), 0)
        self.assertEqual(repairs_for(repairs, "R-QLT-01"), [])

    def test_unknown_is_missing_when_rare(self):
        df = pd.DataFrame({"src": ["web", "app"] * 5 + ["Unknown"]})
        out, _ = sanitize_dataframe(df)
        self.assertEqual(int(out["src"].isna().sum()), 1)

    # R-QLT-03
    def test_currency_percent_and_thousands_are_parsed(self):
        df = pd.DataFrame({
            "price": ["$1,200", "$300", "$45.50", "(12)", "€1,234,567"] * 4,
            "rate": ["10%", "5%", "12.5%", "1%", "7%"] * 4,
        })
        out, repairs = sanitize_dataframe(df)
        self.assertEqual(out["price"].dtype, "float64")
        self.assertEqual(out["price"].tolist()[:5], [1200.0, 300.0, 45.5, -12.0, 1234567.0])
        self.assertEqual(out["rate"].tolist()[:3], [10.0, 5.0, 12.5])  # percent sign stripped, not divided
        rate_repair = repairs_for(repairs, "R-QLT-03", "rate")[0]
        self.assertIn("percent sign", rate_repair["description"])

    def test_numeric_text_with_unparseable_remainder_becomes_nan(self):
        values = [str(i) for i in range(1, 20)] + ["abc"]
        out, repairs = sanitize_dataframe(pd.DataFrame({"n": values}))
        self.assertEqual(out["n"].dtype, "float64")
        self.assertEqual(int(out["n"].isna().sum()), 1)
        self.assertIn("1 value(s)", repairs_for(repairs, "R-QLT-03")[0]["description"])

    def test_leading_zero_codes_are_not_converted(self):
        df = pd.DataFrame({"zip": ["00123", "04567", "01234", "98765", "00999"] * 3})
        out, repairs = sanitize_dataframe(df)
        self.assertEqual(repairs_for(repairs, "R-QLT-03"), [])
        self.assertEqual(out["zip"].tolist()[0], "00123")

    def test_mostly_text_column_is_not_converted(self):
        df = pd.DataFrame({"mixed": ["1", "two", "three", "4", "five", "six", "seven", "8", "nine", "ten"]})
        out, repairs = sanitize_dataframe(df)
        self.assertEqual(repairs_for(repairs, "R-QLT-03"), [])

    # R-QLT-04
    def test_yes_no_text_becomes_one_zero(self):
        df = pd.DataFrame({"flag": ["Yes", "no", " YES", "No", "yes"] * 4})
        out, repairs = sanitize_dataframe(df)
        self.assertEqual(out["flag"].tolist()[:5], [1, 0, 1, 0, 1])
        self.assertEqual(len(repairs_for(repairs, "R-QLT-04", "flag")), 1)

    def test_single_boolean_token_is_left_alone(self):
        out, repairs = sanitize_dataframe(pd.DataFrame({"flag": ["yes"] * 10}))
        self.assertEqual(repairs_for(repairs, "R-QLT-04"), [])

    def test_boolean_pair_keeps_missing(self):
        out, _ = sanitize_dataframe(pd.DataFrame({"flag": ["true", "false", None, "true"]}))
        self.assertEqual(int(out["flag"].isna().sum()), 1)
        self.assertEqual(out["flag"].dropna().tolist(), [1.0, 0.0, 1.0])

    # R-QLT-05 / R-QLT-07
    def test_case_and_spacing_variants_merge_to_most_frequent_spelling(self):
        values = ["Male"] * 6 + ["male"] * 2 + ["MALE  "] + ["Female"] * 5 + ["female"] * 2
        out, repairs = sanitize_dataframe(pd.DataFrame({"g": values}))
        self.assertEqual(set(out["g"].dropna().unique()), {"Male", "Female"})
        self.assertTrue(repairs_for(repairs, "R-QLT-05", "g"))
        self.assertTrue(repairs_for(repairs, "R-QLT-07", "g"))  # the trailing spaces

    def test_inner_whitespace_runs_are_collapsed(self):
        values = ["New York"] * 5 + ["New   York"] * 2 + ["Boston"] * 5
        out, repairs = sanitize_dataframe(pd.DataFrame({"city": values}))
        self.assertEqual(set(out["city"]), {"New York", "Boston"})

    def test_tie_between_spellings_is_deterministic(self):
        values = ["b", "B", "b", "B", "x", "x", "x", "x"]
        first, _ = sanitize_dataframe(pd.DataFrame({"c": values}))
        second, _ = sanitize_dataframe(pd.DataFrame({"c": values}))
        self.assertEqual(first["c"].tolist(), second["c"].tolist())
        self.assertEqual(first["c"].tolist()[:4], ["b", "b", "b", "b"])  # first spelling seen wins a tie

    def test_free_text_is_not_merged(self):
        values = [f"Review number {i}" for i in range(20)] + ["review number 0"]
        out, repairs = sanitize_dataframe(pd.DataFrame({"t": values}))
        self.assertEqual(repairs_for(repairs, "R-QLT-05"), [])

    # R-QLT-06
    def test_infinite_values_become_nan(self):
        df = pd.DataFrame({"v": [1.0, np.inf, 2.0, -np.inf, 3.0]})
        out, repairs = sanitize_dataframe(df)
        self.assertEqual(int(out["v"].isna().sum()), 2)
        self.assertEqual(repairs_for(repairs, "R-QLT-06")[0]["affected_count"], 2)

    # R-QLT-02
    def test_extreme_sentinel_becomes_nan(self):
        ages = ([25, 30, 40, 35, 50, 45] * 6) + [-999] * 4
        out, repairs = sanitize_dataframe(pd.DataFrame({"age": ages}))
        self.assertEqual(int(out["age"].isna().sum()), 4)
        self.assertEqual(repairs_for(repairs, "R-QLT-02", "age")[0]["affected_count"], 4)

    def test_sentinel_inside_normal_range_is_untouched(self):
        # 999 is an ordinary price here, so nothing may be nulled
        prices = [100, 500, 999, 1200, 800, 999, 300, 700, 999, 1500] * 4
        out, repairs = sanitize_dataframe(pd.DataFrame({"price": prices}))
        self.assertEqual(int(out["price"].isna().sum()), 0)
        self.assertEqual(repairs_for(repairs, "R-QLT-02"), [])

    def test_rare_sentinel_below_one_percent_is_untouched(self):
        values = [10.0, 11.0, 12.0, 13.0, 14.0] * 40 + [-999.0]  # 1 of 201 rows
        out, repairs = sanitize_dataframe(pd.DataFrame({"v": values}))
        self.assertEqual(repairs_for(repairs, "R-QLT-02"), [])

    def test_minus_one_kept_when_column_has_other_negatives(self):
        values = [-5, -1, 0, 3, -2, 4, -1, 2, -3, 5, -1, 1] * 3
        out, repairs = sanitize_dataframe(pd.DataFrame({"delta": values}))
        self.assertEqual(repairs_for(repairs, "R-QLT-02"), [])

    # Pipeline of rules on one column
    def test_token_then_numeric_conversion_chain(self):
        df = pd.DataFrame({"inc": ["100", "200", "?", "300", "N/A"] * 4})
        out, repairs = sanitize_dataframe(df)
        self.assertEqual(out["inc"].dtype, "float64")
        self.assertEqual(int(out["inc"].isna().sum()), 8)
        ids = [r["rule_id"] for r in repairs if r["column"] == "inc"]
        self.assertEqual(ids, ["R-QLT-01", "R-QLT-03"])

    # Replay parameters recorded on each repair
    def test_repairs_record_their_replay_parameters(self):
        df = pd.DataFrame({
            "city": ["Paris", "paris ", " N/A ", "?", "Rome", "ROME", "Paris", "Paris", "Rome", "Rome"] * 2,
            "flag": ["Yes", "no", "YES", "No"] * 5,
            "age": [-999, 31, 40, 52, 47, 38, 44, 29, 35, 41] * 2,
            "price": ["$1,200", "$300", "(12)", "5%"] * 5,
        })
        _, repairs = sanitize_dataframe(df)
        replay = {(r["rule_id"], r["column"]): r["replay"] for r in repairs}
        self.assertEqual(replay[("R-QLT-07", "city")], {})
        self.assertEqual(replay[("R-QLT-01", "city")], {"tokens": ["?", "n/a"]})  # normalized, as found
        self.assertEqual(replay[("R-QLT-05", "city")], {"mapping": {"paris": "Paris", "ROME": "Rome"}})
        self.assertEqual(replay[("R-QLT-04", "flag")], {"positive": "yes", "negative": "no"})
        self.assertEqual(replay[("R-QLT-02", "age")], {"codes": [-999]})
        self.assertEqual(replay[("R-QLT-03", "price")], {})

    def test_clean_data_yields_no_repairs(self):
        df = pd.DataFrame({"a": [1.5, 2.5, 3.5, 4.5], "b": ["x", "y", "x", "y"]})
        out, repairs = sanitize_dataframe(df)
        self.assertEqual(repairs, [])
        pd.testing.assert_frame_equal(out, df)


if __name__ == "__main__":
    unittest.main()

import unittest
import io
import pandas as pd
from backend.app.parser import load_file_to_dataframe, sniff_delimiter, detect_encoding

class TestParser(unittest.TestCase):

    def test_csv_parsing_and_delimiter_sniffing(self):
        csv_data = "col_a,col_b,col_c\n1,apple,3.14\n2,banana,2.71\n".encode("utf-8")
        df, meta = load_file_to_dataframe(csv_data, "test.csv")
        self.assertEqual(meta["format"], "csv")
        self.assertEqual(meta["detected_delimiter"], ",")
        self.assertEqual(len(df), 2)
        self.assertEqual(list(df.columns), ["col_a", "col_b", "col_c"])

    def test_tsv_parsing(self):
        tsv_data = "feature1\tfeature2\tfeature3\n10\tA\t100\n20\tB\t200\n".encode("utf-8")
        df, meta = load_file_to_dataframe(tsv_data, "dataset.tsv")
        self.assertEqual(meta["format"], "tsv")
        self.assertEqual(meta["detected_delimiter"], "\t")
        self.assertEqual(len(df), 2)
        self.assertEqual(list(df.columns), ["feature1", "feature2", "feature3"])

    def test_semicolon_delimited_sniffing(self):
        data = "id;name;score\n1;Alice;95\n2;Bob;88\n3;Charlie;79\n".encode("utf-8")
        df, meta = load_file_to_dataframe(data, "european.txt")
        self.assertEqual(meta["detected_delimiter"], ";")
        self.assertEqual(len(df), 3)

    def test_json_records_parsing(self):
        json_data = b'[{"user": "u1", "age": 25, "active": true}, {"user": "u2", "age": 30, "active": false}]'
        df, meta = load_file_to_dataframe(json_data, "users.json")
        self.assertEqual(meta["format"], "json")
        self.assertEqual(len(df), 2)
        self.assertIn("user", df.columns)

    def test_header_sanitization(self):
        messy_csv = "  col a  ,col b,col a\n1,2,3\n".encode("utf-8")
        df, meta = load_file_to_dataframe(messy_csv, "messy.csv")
        # Should strip whitespace and deduplicate repeated headers
        self.assertEqual(df.columns[0], "col a")
        self.assertEqual(df.columns[1], "col b")
        self.assertEqual(df.columns[2], "col a_1")

if __name__ == "__main__":
    unittest.main()

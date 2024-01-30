from pathlib import Path
import yaml
import markdown

# See https://github.com/jazzband/prettytable/issues/40#issuecomment-846439234
import html

html.escape = lambda *args, **kwargs: args[0]
from prettytable import PrettyTable, MARKDOWN


def to_table(attrs, is_inputs=True):
    rows = []
    for key, value in attrs.items():
        description = value.get("description", "")
        row = [key, description]

        if is_inputs:
            required = value.get("required", False)
            default = value.get("default", "")
            row += [
                default,
                required,
            ]

        rows += [row]
    return rows


def to_pretty_code(val):
    match val:
        case "":
            return '`""`'
        case True:
            return f"`true`"
        case False:
            return f"`false`"
        case _:
            return f"`{val}`"


def to_pretty_table(table, is_inputs=True):
    x = PrettyTable()
    x.field_names = ["name", "description"] + (
        ["default", "required"] if is_inputs else []
    )
    pretty_rows = [
        [to_pretty_code(row[0]), row[1]]
        + ([to_pretty_code(row[2]), to_pretty_code(row[3])] if is_inputs else [])
        for row in table
    ]
    markdown_rows = [
        [markdown.markdown(val).replace("\n", "") for val in row] for row in pretty_rows
    ]
    x.add_rows(markdown_rows)
    x.set_style(MARKDOWN)
    x.align = "l"

    return x


def run(yamls):
    for path, has_outputs, heading_level in yamls:
        dir = Path(path).parent
        readme_md = dir / "README.md"
        with open(path, "r") as action:
            action_yml = yaml.safe_load(action.read())

        with open(readme_md, "r") as readme:
            readme_lines = readme.readlines()

        for i, line in enumerate(readme_lines):
            for attr, heading, is_inputs in [
                ["inputs", "Inputs", True],
                ["outputs", "Outputs", False],
            ]:
                if line.find(f'{"#" * heading_level} {heading}') != -1 and not (
                    heading == "Outputs" and not has_outputs
                ):
                    table = to_table(action_yml.get(attr), is_inputs=is_inputs)
                    pretty_table = to_pretty_table(table, is_inputs=is_inputs)
                    table_html = (
                        f"{pretty_table.get_html_string()}".replace("\n", "") + "\n"
                    )
                    readme_lines[i + 2] = table_html

        with open(readme_md, "w") as readme:
            readme.writelines(readme_lines)


def main():
    yamls = [
        # - yaml path
        # - whether the action has outputs
        # - number of `#` in an Inputs/Outputs section heading level
        ["save/action.yml", False, 3],
        ["restore/action.yml", True, 3],
        ["action.yml", True, 3],
    ]
    run(yamls=yamls)


if __name__ == "__main__":
    main()

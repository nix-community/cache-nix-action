import sys
import yaml

from lxml.etree import tostring, fromstring
from lxml.builder import E
import markdown
import argparse
import textwrap


def convert_to_table(attrs, is_inputs=True):
    columns = ["name", "description"]

    if is_inputs:
        columns += ["default", "required"]

    root = E.table(
        E.tr(*[E.th(c) for c in columns]),
    )

    for key, value in attrs.items():
        key_pretty = f"`{key}`"
        description = value.get("description", "")
        columns = [key_pretty, description]

        if is_inputs:
            required = (
                "`true`"
                if (required := value.get("required", "`false`")) == True
                else required
            )

            default = (
                f"`{default}`"
                if (default := value.get("default"))
                else "`''`"
                if default == ""
                else ""
            )

            columns += [
                default,
                required,
            ]

        root.append(
            E.tr(
                *[
                    E.td(fromstring(f"<div>{markdown.markdown(x)}</div>"))
                    for x in columns
                ]
            )
        )

    return (
        tostring(
            root,
            encoding="UTF-16",
            xml_declaration=False,
        )
        .decode("UTF-16")
        .replace("\n", "")
    )


def main():
    parser = argparse.ArgumentParser(
        description="Convert `action.yaml` to HTML tables."
    )

    parser.add_argument("path", help="path to `action.yaml`")

    args = parser.parse_args()

    result = None
    with open(args.path, "r") as action:
        action_yaml = yaml.safe_load(action.read())

        result = textwrap.dedent(
            "\n".join(
                [
                    f"""
                    ### {heading}
                    
                    {convert_to_table(attrs, is_inputs=is_inputs)}"""
                    if (attrs := action_yaml.get(attr))
                    else ""
                    for attr, heading, is_inputs in [
                        ["inputs", "Inputs", True],
                        ["outputs", "Outputs", False],
                    ]
                ]
            )
        )

    print(f"{result}\n")


if __name__ == "__main__":
    main()

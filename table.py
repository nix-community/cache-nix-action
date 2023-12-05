import yaml
import re

action_yaml = {}

with open("action.yml", "r") as action:
    action_yaml = yaml.safe_load(action.read())

header = f"| `name` | `description` | `required` | `default` | `requires` |"
print(header)
print("".join(map(lambda x: "|" if x == "|" else "-", list(header))))

for key, value in action_yaml["inputs"].items():
    description = value.get("description")
    requires = (
        match.group(1) if (match := re.search("Requires (.*).", description)) else ""
    )
    description_no_requires = (
        match.group(1)
        if (match := re.search("(.*) Requires", description))
        else description
    )
    required = (
        "`true`" if (required := value.get("required", "`false`")) == True else required
    )
    default = (
        f"`{default}`"
        if (default := value.get("default"))
        else "`''`"
        if default == ""
        else ""
    )

    print(
        f"| `{key}` | {description_no_requires} | {required} | {default} |  {requires}"
    )

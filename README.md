# Auto Expand On Enter

![demo](https://user-images.githubusercontent.com/7388088/71270683-dd985c00-235a-11ea-9749-81a78f5f7b9e.gif)

## Features

- smart expand for braces ex.
    - `SOL|}`, `ES|}` ,`SOL{|`, `someText{|EOL` will add a single new line "normal behavior"
        > <sub>| == cursor</sub><br>
        > <sub>SOL == start of line</sub><br>
        > <sub>EOL == end of line</sub><br>
        > <sub>ES == empty spaces</sub><br>

- expand method chains
- expand arguments, array items
- expand html tags "using emmet `balanceOut` command"

### Notes

- expanding both braces & html tags at the same time wont work, as expanding braces have will take over

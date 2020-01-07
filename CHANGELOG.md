# Change Log

## 0.0.1

- Initial release

## 0.0.2

- shorter debounce time
- make sure to get last char on line not first match
- better check for prev line indentation

## 0.0.3

- fix error of incorrect line value which happens on undo
- correct brace count checking

## 0.0.4

- add delay to config

## 0.0.6

- fix cant find document is undefined

## 0.0.7

- fix double undo even when no braces were on the next line

## 0.0.9

- cleanup and small fixes
- now undo is one step instead of multiple
- support similar chars ex.back-ticks
- support for any chars limit instead of single ones only ex.`/*`

## 0.1.0

- use command instead of relying on content change event

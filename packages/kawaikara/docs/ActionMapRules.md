# ActionChainMap Rules


Modifier Key

[direction literal] + [modifier name]

## Modifier
- alt
- meta (Window Key or Meta key in **Mac**)
- shift

# Ignore Keys
We ignore some presets. Because It was already reserved for Main functinality.

AKA MenuBar, Fullscreen, and so on.

### examples
```
lctrl :=> [Left] + [Control]
lshift :=> [Left] + [Shift]


```


## Combination Rule
```
["lctrl+r", "lctrl+j"] : string[]
["lctrl+r"] : string[]
```
If you try to use like that, then It remove first registered Action.
Because System Can't evaluate it's Action.(actually it's my reponsibility.
But I decide to make **Simple Shortcut Manager**.)


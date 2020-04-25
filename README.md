# LoC-Badge
Count project Lines of Code & generate a badge for display.

## To use:
In a Github Action, download your project and run this action:

```yaml
      - name: Launch the local action
        uses: ./ # Uses an action in the root directory
        id: badge
        with:
          debug: true
          directory: ./
          badge: ./output/badge.svg
          patterns: '*.js'  # Patterns in the format of a '.gitignore' file, separated by pipes.
          ignore: 'node_modules'
```

Once the badge has been generated, use whatever tool you prefer to upload it somewhere.
I personally prefer to push the badges to another branch of the project, where they can be linked easily.

You can [see a full example file that does this here.](./.github/workflows/main.yml)

The output badge can be customized. [Check out the input options here.](./action.yml)

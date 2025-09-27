import { Link } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { Platform } from 'react-native'

export function ExternalLink(props: React.ComponentProps<typeof Link>) {
  const href = props.href
  return (
    <Link
      target="_blank"
      {...props}
      onPress={(event) => {
        if (Platform.OS !== 'web' && typeof href === 'string') {
          event.preventDefault()
          void WebBrowser.openBrowserAsync(href)
        }
      }}
    />
  )
}

import { gql } from '@apollo/client/core/core.cjs'
import { useMutation } from '@apollo/client/react/hooks/hooks.cjs'
import { Me } from './me'

const signIn = gql`
  mutation signIn($input: SignInInput) {
    signIn(input: $input) {
      user {
        isAuthenticated
        username
      }
    }
  }
`
const useSignIn = () =>
  useMutation(signIn, {
    update: (cache, mutationResult) => {
      const {
        signIn: { user },
      } = mutationResult.data
      cache.updateQuery({ query: Me }, (data) => ({
        ...data,
        me: { ...user },
      }))
    },
  })

export { signIn, useSignIn }

import React, { useEffect } from 'react'
import combinedReducer from 'store/reducers'
import { useAppDispatch, useAppSelector } from 'store/hooks'
import { fetchAccount, hasPermission } from 'store/modules/user'
import usersReducer, { sliceInjectNoOp } from '../../modules/users'
import About from '../../components/About/About'
import Account from '../../components/Account/Account'
import LanguagePrefs from '../../components/LanguagePrefs/LanguagePrefs'
import Prefs from '../../components/Prefs/Prefs'
import Rooms from '../../components/Rooms/Rooms'
import Users from '../../components/Users/Users'

const SignedInView = () => {
  const user = useAppSelector(state => state.user)
  const sliceExists = !!useAppSelector(state => state.users)
  const dispatch = useAppDispatch()
  // admins see everything; ghost managers only see their own ghosts
  const canManageUsers = user.isAdmin || hasPermission(user, 'ghostUsers')

  if (canManageUsers && !sliceExists) {
    combinedReducer.inject({ reducerPath: 'users', reducer: usersReducer })
    dispatch(sliceInjectNoOp()) // update store with new slice
  }

  // once per mount
  useEffect(() => {
    (async () => dispatch(fetchAccount()))()
  }, [dispatch])

  return (
    <>
      <LanguagePrefs />

      {user.isAdmin
        && <Rooms />}

      {canManageUsers
        && <Users />}

      {user.isAdmin
        && <Prefs />}

      <Account />

      <About />
    </>
  )
}

export default SignedInView

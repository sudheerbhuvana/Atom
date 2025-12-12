import { usernameSchema, passwordSchema, loginSchema, registerSchema } from '../validation'

describe('Validation Schemas', () => {
  describe('usernameSchema', () => {
    it('should accept valid usernames', () => {
      expect(usernameSchema.safeParse('user123').success).toBe(true)
      expect(usernameSchema.safeParse('user_name').success).toBe(true)
      expect(usernameSchema.safeParse('user-name').success).toBe(true)
    })

    it('should reject usernames that are too short', () => {
      const result = usernameSchema.safeParse('ab')
      expect(result.success).toBe(false)
    })

    it('should reject usernames that are too long', () => {
      const result = usernameSchema.safeParse('a'.repeat(51))
      expect(result.success).toBe(false)
    })

    it('should reject usernames with invalid characters', () => {
      expect(usernameSchema.safeParse('user@name').success).toBe(false)
      expect(usernameSchema.safeParse('user name').success).toBe(false)
      expect(usernameSchema.safeParse('user.name').success).toBe(false)
    })
  })

  describe('passwordSchema', () => {
    it('should accept valid passwords', () => {
      expect(passwordSchema.safeParse('password123').success).toBe(true)
      expect(passwordSchema.safeParse('a'.repeat(8)).success).toBe(true)
      expect(passwordSchema.safeParse('a'.repeat(128)).success).toBe(true)
    })

    it('should reject passwords that are too short', () => {
      const result = passwordSchema.safeParse('short')
      expect(result.success).toBe(false)
    })

    it('should reject passwords that are too long', () => {
      const result = passwordSchema.safeParse('a'.repeat(129))
      expect(result.success).toBe(false)
    })
  })

  describe('loginSchema', () => {
    it('should accept valid login data', () => {
      const result = loginSchema.safeParse({
        username: 'testuser',
        password: 'password123'
      })
      expect(result.success).toBe(true)
    })

    it('should reject invalid login data', () => {
      expect(loginSchema.safeParse({ username: 'ab', password: 'pass' }).success).toBe(false)
      expect(loginSchema.safeParse({ username: 'user', password: 'short' }).success).toBe(false)
    })
  })

  describe('registerSchema', () => {
    it('should accept valid registration data', () => {
      const result = registerSchema.safeParse({
        username: 'newuser',
        password: 'securepass123'
      })
      expect(result.success).toBe(true)
    })
  })
})


import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Customer Registration Confirm Password & Matching Suite', () => {
  const headerPath = path.resolve(process.cwd(), 'src/components/site/Header.tsx');
  const content = fs.readFileSync(headerPath, 'utf8');

  it('contract: Header.tsx declares confirmPassword state initialized to empty string', () => {
    expect(content).toContain("const [confirmPassword, setConfirmPassword] = useState('');");
  });

  it('contract: Header.tsx renders "Xác nhận mật khẩu" input for authMode === register', () => {
    expect(content).toContain('{authMode === \'register\' && (');
    expect(content).toContain('placeholder="Xác nhận mật khẩu"');
    expect(content).toContain('type="password"');
    expect(content).toContain('value={confirmPassword}');
    expect(content).toContain('onChange={(e) => { setConfirmPassword(e.target.value); setError(\'\'); }}');
  });

  it('contract: Header.tsx displays mismatch error message when confirm password differs from password', () => {
    expect(content).toContain('Boolean(confirmPassword && password !== confirmPassword)');
    expect(content).toContain('Mật khẩu xác nhận chưa trùng khớp');
  });

  it('contract: Header.tsx disables the "Tạo tài khoản" button when confirmPassword is empty or mismatched', () => {
    expect(content).toContain(
      "const isRegisterSubmitDisabled = authMode === 'register' && (!confirmPassword || password !== confirmPassword);"
    );
    expect(content).toContain('disabled={loading || isRegisterSubmitDisabled}');
  });

  it('contract: handlePasswordAuth validates confirmPassword and rejects submit if mismatching', () => {
    expect(content).toContain("if (!confirmPassword) {");
    expect(content).toContain("setError('Vui lòng nhập lại mật khẩu để xác nhận');");
    expect(content).toContain("if (password !== confirmPassword) {");
    expect(content).toContain("setError('Mật khẩu xác nhận không trùng khớp');");
    expect(content).toContain("confirm_password: confirmPassword");
  });

  it('contract: clears confirmPassword when closing modal or toggling between login and register', () => {
    expect(content).toContain("setConfirmPassword('');");
  });
});

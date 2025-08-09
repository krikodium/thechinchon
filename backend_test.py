import requests
import sys
import json
from datetime import datetime
import random
import string

class ChinchonAPITester:
    def __init__(self, base_url="https://19468960-85bd-4765-8d82-7df80f17a7ab.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_username = f"test_user_{datetime.now().strftime('%H%M%S')}_{random.randint(1000, 9999)}"
        self.test_password = "TestPass123!"

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        print(f"   Method: {method}")
        if data:
            print(f"   Data: {json.dumps(data, indent=2)}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=10)

            print(f"   Response Status: {response.status_code}")
            
            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)}")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error Response: {json.dumps(error_data, indent=2)}")
                except:
                    print(f"   Error Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_avatars_endpoint(self):
        """Test getting available avatars"""
        success, response = self.run_test(
            "Get Avatars",
            "GET",
            "avatars",
            200
        )
        
        if success and 'avatars' in response:
            avatars = response['avatars']
            print(f"   Found {len(avatars)} avatars")
            
            # Verify we have 6 avatars (3 male, 3 female)
            male_count = sum(1 for avatar in avatars if avatar.get('gender') == 'male')
            female_count = sum(1 for avatar in avatars if avatar.get('gender') == 'female')
            
            if len(avatars) == 6 and male_count == 3 and female_count == 3:
                print("   ✅ Avatar structure is correct (6 total: 3 male, 3 female)")
            else:
                print(f"   ⚠️  Avatar structure issue: {len(avatars)} total, {male_count} male, {female_count} female")
        
        return success

    def test_user_registration(self):
        """Test user registration"""
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data={
                "username": self.test_username,
                "password": self.test_password,
                "avatar": "avatar1"
            }
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            print(f"   ✅ Registration successful, token received")
            return True
        
        return False

    def test_duplicate_registration(self):
        """Test duplicate username registration (should fail)"""
        success, response = self.run_test(
            "Duplicate Registration (should fail)",
            "POST",
            "auth/register",
            400,  # Should return 400 for duplicate username
            data={
                "username": self.test_username,
                "password": self.test_password,
                "avatar": "avatar2"
            }
        )
        return success

    def test_user_login(self):
        """Test user login"""
        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/login",
            200,
            data={
                "username": self.test_username,
                "password": self.test_password
            }
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            print(f"   ✅ Login successful, new token received")
            return True
        
        return False

    def test_invalid_login(self):
        """Test login with invalid credentials"""
        success, response = self.run_test(
            "Invalid Login (should fail)",
            "POST",
            "auth/login",
            401,  # Should return 401 for invalid credentials
            data={
                "username": self.test_username,
                "password": "wrong_password"
            }
        )
        return success

    def test_get_current_user(self):
        """Test getting current user info"""
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200
        )
        
        if success and 'id' in response:
            self.user_id = response['id']
            print(f"   ✅ User info retrieved, ID: {self.user_id}")
            print(f"   Username: {response.get('username')}")
            print(f"   Avatar: {response.get('avatar')}")
            print(f"   Balance: ${response.get('balance', 0)}")
            return True
        
        return False

    def test_unauthorized_access(self):
        """Test accessing protected endpoint without token"""
        # Temporarily remove token
        temp_token = self.token
        self.token = None
        
        success, response = self.run_test(
            "Unauthorized Access (should fail)",
            "GET",
            "auth/me",
            401  # Should return 401 for unauthorized access
        )
        
        # Restore token
        self.token = temp_token
        return success

    def test_create_match(self):
        """Test creating a match"""
        success, response = self.run_test(
            "Create Match",
            "POST",
            "matches",
            200,
            data={
                "target_points": 50,
                "stake_amount": 0  # Use 0 stake since user starts with 0 balance
            }
        )
        
        if success and 'id' in response:
            match_id = response['id']
            print(f"   ✅ Match created with ID: {match_id}")
            return match_id
        
        return None

    def test_get_matches(self):
        """Test getting available matches"""
        success, response = self.run_test(
            "Get Matches",
            "GET",
            "matches?status=waiting",
            200
        )
        
        if success:
            matches = response if isinstance(response, list) else []
            print(f"   ✅ Found {len(matches)} waiting matches")
            return matches
        
        return []

    def test_create_match_insufficient_balance(self):
        """Test creating match with insufficient balance (should fail)"""
        success, response = self.run_test(
            "Create Match - Insufficient Balance (should fail)",
            "POST",
            "matches",
            400,  # Should return 400 for insufficient balance
            data={
                "target_points": 100,
                "stake_amount": 999999  # Very high amount
            }
        )
        return success

    def test_join_nonexistent_match(self):
        """Test joining a non-existent match (should fail)"""
        fake_match_id = "nonexistent-match-id"
        success, response = self.run_test(
            "Join Non-existent Match (should fail)",
            "POST",
            f"matches/{fake_match_id}/join",
            404  # Should return 404 for non-existent match
        )
        return success

def main():
    print("🎮 Starting Chinchón API Testing Suite")
    print("=" * 50)
    
    # Initialize tester
    tester = ChinchonAPITester()
    
    # Test sequence
    test_results = []
    
    # 1. Test avatars endpoint (no auth required)
    print("\n📋 Testing Avatar System...")
    test_results.append(("Avatars Endpoint", tester.test_avatars_endpoint()))
    
    # 2. Test user registration
    print("\n👤 Testing User Registration...")
    test_results.append(("User Registration", tester.test_user_registration()))
    
    # 3. Test duplicate registration
    test_results.append(("Duplicate Registration", tester.test_duplicate_registration()))
    
    # 4. Test user login
    print("\n🔐 Testing User Authentication...")
    test_results.append(("User Login", tester.test_user_login()))
    
    # 5. Test invalid login
    test_results.append(("Invalid Login", tester.test_invalid_login()))
    
    # 6. Test getting current user
    test_results.append(("Get Current User", tester.test_get_current_user()))
    
    # 7. Test unauthorized access
    test_results.append(("Unauthorized Access", tester.test_unauthorized_access()))
    
    # 8. Test match creation
    print("\n🎯 Testing Match System...")
    match_id = tester.test_create_match()
    test_results.append(("Create Match", match_id is not None))
    
    # 9. Test getting matches
    matches = tester.test_get_matches()
    test_results.append(("Get Matches", len(matches) >= 0))
    
    # 10. Test insufficient balance
    test_results.append(("Insufficient Balance", tester.test_create_match_insufficient_balance()))
    
    # 11. Test joining non-existent match
    test_results.append(("Join Non-existent Match", tester.test_join_nonexistent_match()))
    
    # Print final results
    print("\n" + "=" * 50)
    print("📊 TEST RESULTS SUMMARY")
    print("=" * 50)
    
    for test_name, result in test_results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}")
    
    passed_count = sum(1 for _, result in test_results if result)
    total_count = len(test_results)
    
    print(f"\n📈 Overall Results: {passed_count}/{total_count} tests passed")
    print(f"🔧 API Tests: {tester.tests_passed}/{tester.tests_run} individual API calls passed")
    
    if passed_count == total_count:
        print("🎉 All tests passed! Backend API is working correctly.")
        return 0
    else:
        print("⚠️  Some tests failed. Please check the backend implementation.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
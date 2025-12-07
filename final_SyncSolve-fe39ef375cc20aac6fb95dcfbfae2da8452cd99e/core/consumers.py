

# import json
# import asyncio
# from channels.generic.websocket import AsyncWebsocketConsumer

# # Dictionary to store waiting users for each problem_id (should use Redis in production)
# waiting_users = {}
# active_users = {}  # ✅ Track active users per problem_id
# waiting_locks = asyncio.Lock()  # Prevents race conditions

# class ChatConsumer(AsyncWebsocketConsumer):
#     async def connect(self):
#         self.problem_id = self.scope['url_route']['kwargs']['problem_id']
#         self.username = None
#         self.partner = None  # Store the partner instance

#         await self.accept()  # ✅ Accept the WebSocket connection

#         async with waiting_locks:  
#             # ✅ Ensure active_users is initialized before incrementing
#             if self.problem_id not in active_users:
#                 active_users[self.problem_id] = 0

#             active_users[self.problem_id] += 1  # ✅ Increment active user count

#             if self.problem_id not in waiting_users:
#                 waiting_users[self.problem_id] = []  # Initialize empty list

#             await self.broadcast_user_count()  # ✅ Broadcast updated count

#             # Find a waiting user who is unpaired
#             for i in range(0, len(waiting_users[self.problem_id]), 2):
#                 if len(waiting_users[self.problem_id][i:i+2]) == 1:
#                     # Pair with this waiting user
#                     self.username = "User 2"
#                     self.partner = waiting_users[self.problem_id][i]
#                     waiting_users[self.problem_id].append(self)

#                     # ✅ Establish two-way link
#                     self.partner.partner = self

#                     # Notify both users
#                     await self.partner.send(json.dumps({
#                         'message': "Partner matched! You can start chatting now.",
#                         'username': "System"
#                     }))
#                     await self.send(json.dumps({
#                         'message': "Partner matched! You can start chatting now.",
#                         'username': "System"
#                     }))
#                     break
#             else:
#                 # No available partner, so wait
#                 self.username = "User 1"
#                 waiting_users[self.problem_id].append(self)
#                 await self.send(json.dumps({
#                     'message': "Matching buddy...",
#                     'username': "System"
#                 }))


#     async def disconnect(self, close_code):
#         async with waiting_locks:
#             if self.problem_id in waiting_users and self in waiting_users[self.problem_id]:
#                 waiting_users[self.problem_id].remove(self)

#             # Notify the partner if they exist
#             if self.partner:
#                 try:
#                     await self.partner.send(json.dumps({
#                         'message': "Your partner has disconnected.",
#                         'username': "System"
#                     }))
#                 except Exception:
#                     pass  # Ignore errors if partner already disconnected

#                 self.partner.partner = None  # Remove reference
#                 self.partner = None

#             # Ensure active user count is decremented correctly
#             if self.problem_id in active_users:
#                 active_users[self.problem_id] -= 1
#                 if active_users[self.problem_id] <= 0:
#                     del active_users[self.problem_id]  # Cleanup if no users left

#             await self.broadcast_user_count()  # ✅ Broadcast updated count

#             # If no users left in waiting_users, clean up
#             if self.problem_id in waiting_users and not waiting_users[self.problem_id]:
#                 del waiting_users[self.problem_id]


#     async def receive(self, text_data):
#         data = json.loads(text_data)
#         message = data['message']

#         # ✅ Forward the message to the partner if they exist
#         if self.partner:
#             try:
#                 await self.partner.send(json.dumps({
#                     'message': message,
#                     'username': self.username
#                 }))
#             except Exception:
#                 pass  # ✅ Avoid crash if partner is disconnected

#         # ✅ Also send the message back to the sender so they see it
#         await self.send(json.dumps({
#             'message': message,
#             'username': self.username
#         }))

#     async def broadcast_user_count(self):
#         """ ✅ Added: Broadcast the number of online users for this problem """
#         count = active_users.get(self.problem_id, 0)

#         # ✅ Ensure safe broadcasting (ignore disconnected users)
#         for user in list(waiting_users.get(self.problem_id, [])):
#             try:
#                 await user.send(json.dumps({
#                     'type': 'online_users',
#                     'count': count
#                 }))
#             except Exception:
#                 pass  # ✅ Ignore errors from disconnected clients






















import json
import asyncio
import requests
from channels.generic.websocket import AsyncWebsocketConsumer
from django.utils import timezone
from core.models import CompetitiveSession, Participation, Quiz

waiting_users = {}
active_users = {}
waiting_locks = asyncio.Lock()


def get_leetcode_link(problem_number):
    """Fetches the LeetCode link for the given problem number."""
    url = "https://leetcode.com/api/problems/all/"
    try:
        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            data = response.json()
            for question in data["stat_status_pairs"]:
                if question["stat"]["frontend_question_id"] == int(problem_number):
                    slug = question["stat"]["question__title_slug"]
                    return f"https://leetcode.com/problems/{slug}/"
    except Exception as e:
        print(f"Error fetching LeetCode link: {e}")
    return "Problem not found"


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.problem_id = self.scope['url_route']['kwargs']['problem_id']
        self.username = None
        self.partner = None
        self.quiz_id = None
        self.session = None
        self.is_user1 = True

        # Extract quiz_id from query parameters if present
        query_string = self.scope.get('query_string', b'').decode()
        if 'quiz=' in query_string:
            self.quiz_id = int(query_string.split('quiz=')[1].split('&')[0])

        await self.accept()

        async with waiting_locks:
            if self.problem_id not in active_users:
                active_users[self.problem_id] = 0
            active_users[self.problem_id] += 1

            if self.problem_id not in waiting_users:
                waiting_users[self.problem_id] = []
            
            await self.broadcast_user_count()

            # Try to find a partner
            partner_found = False
            for i in range(0, len(waiting_users[self.problem_id]), 2):
                if len(waiting_users[self.problem_id][i:i+2]) == 1:
                    self.username = "User 2"
                    self.partner = waiting_users[self.problem_id][i]
                    self.is_user1 = False
                    waiting_users[self.problem_id].append(self)
                    self.partner.partner = self

                    # If quiz_id is present, initialize competitive session
                    if self.quiz_id:
                        await self.initialize_competitive_session()
                    
                    await self.partner.send(json.dumps({
                        'message': "Partner matched! You can start chatting now.",
                        'username': "System"
                    }))
                    await self.send(json.dumps({
                        'message': "Partner matched! You can start chatting now.",
                        'username': "System"
                    }))
                    partner_found = True
                    break
            
            if not partner_found:
                self.username = "User 1"
                waiting_users[self.problem_id].append(self)
                await self.send(json.dumps({
                    'message': "Matching buddy...",
                    'username': "System"
                }))

    async def initialize_competitive_session(self):
        """Initialize competitive session when both users are matched"""
        try:
            quiz = await self.get_quiz(self.quiz_id)
            if not quiz:
                await self.send(json.dumps({
                    'type': 'error',
                    'message': 'Quiz not found'
                }))
                return

            # Get or create competitive session
            # Always use consistent user ordering: first connector is user1
            try:
                if self.is_user1:
                    user1_name = self.username
                    user2_name = self.partner.username if self.partner else "User 2"
                else:
                    user1_name = self.partner.username if self.partner else "User 1"
                    user2_name = self.username

                self.session = await self.get_or_create_session(
                    self.quiz_id,
                    self.problem_id,
                    user1_name,
                    user2_name
                )
                
                # Make sure partner also has the same session reference
                if self.partner:
                    self.partner.session = self.session
                    print(f"Set partner session: {self.session.id}")
            except Exception as e:
                print(f"Error creating session: {e}")
                import traceback
                traceback.print_exc()
                return

            # Send quiz to both users
            quiz_data = {
                'type': 'quiz_start',
                'quiz_id': self.quiz_id,
                'room_id': self.problem_id,
                'duration': quiz['duration'],
                'questions': quiz['questions'],
                'start_time': timezone.now().isoformat()
            }

            # Send to partner
            if self.partner:
                await self.partner.send(json.dumps(quiz_data))
            
            # Send to self
            await self.send(json.dumps(quiz_data))

        except Exception as e:
            print(f"Error initializing competitive session: {e}")
            import traceback
            traceback.print_exc()

    async def disconnect(self, close_code):
        async with waiting_locks:
            if self.problem_id in waiting_users and self in waiting_users[self.problem_id]:
                waiting_users[self.problem_id].remove(self)

            if self.partner:
                try:
                    await self.partner.send(json.dumps({
                        'message': "Your partner has disconnected.",
                        'username': "System"
                    }))
                except Exception:
                    pass

                self.partner.partner = None
                self.partner = None

            if self.problem_id in active_users:
                active_users[self.problem_id] -= 1
                if active_users[self.problem_id] <= 0:
                    del active_users[self.problem_id]

            await self.broadcast_user_count()

            if self.problem_id in waiting_users and not waiting_users[self.problem_id]:
                del waiting_users[self.problem_id]

    async def receive(self, text_data):
        data = json.loads(text_data)
        
        # Handle quiz answer submission
        if data.get('type') == 'quiz_answer':
            await self.handle_quiz_answer(data)
            return

        # Handle regular chat message
        message = data.get("message", "")

        if self.partner:
            try:
                await self.partner.send(json.dumps({
                    "message": message,
                    "username": self.username
                }))
            except Exception:
                pass

        await self.send(json.dumps({
            "message": message,
            "username": self.username
        }))

    async def handle_quiz_answer(self, data):
        """Handle quiz answer submission from participant"""
        try:
            answers = data.get('answers', [])
            submission_time = data.get('submission_time', 0)

            print(f"\n📝 Quiz answer received from {self.username}: {submission_time}s")
            print(f"   Session ID: {self.session.id if self.session else 'NO SESSION'}")
            print(f"   Is User 1: {self.is_user1}")
            print(f"   Answers: {answers}")

            if self.is_user1:
                # Update User 1 score
                print(f"   Creating participation for User 1...")
                participation = await self.create_participation(
                    self.session, self.username, answers, submission_time, True
                )
                print(f"   Participation returned: {participation}")
                
                score = await self.calculate_score(participation)
                print(f"   Calculated score: {score}%")
                
                if self.session:
                    await self.update_session_score(self.session, score, submission_time, True)
                    print(f"   Session score updated")

                # Notify partner
                if self.partner:
                    await self.partner.send(json.dumps({
                        'type': 'partner_submitted',
                        'message': f"Your partner ({self.username}) has submitted their answers!"
                    }))
            else:
                # Update User 2 score
                print(f"   Creating participation for User 2...")
                participation = await self.create_participation(
                    self.session, self.username, answers, submission_time, False
                )
                print(f"   Participation returned: {participation}")
                
                score = await self.calculate_score(participation)
                print(f"   Calculated score: {score}%")
                
                if self.session:
                    await self.update_session_score(self.session, score, submission_time, False)
                    print(f"   Session score updated")

                # Notify partner
                if self.partner:
                    await self.partner.send(json.dumps({
                        'type': 'partner_submitted',
                        'message': f"Your partner ({self.username}) has submitted their answers!"
                    }))

            # Check if both have submitted, then send results
            if self.session:
                print(f"🔍 Checking if both have submitted for session {self.session.id}...")
                await self.check_and_send_results()

        except Exception as e:
            print(f"❌ Error handling quiz answer: {e}")
            import traceback
            traceback.print_exc()
            await self.send(json.dumps({
                'type': 'error',
                'message': str(e)
            }))

    async def broadcast_user_count(self):
        count = active_users.get(self.problem_id, 0)

        for user in list(waiting_users.get(self.problem_id, [])):
            try:
                await user.send(json.dumps({
                    "type": "online_users",
                    "count": count
                }))
            except Exception:
                pass

    # Database helper methods (sync wrappers)
    async def get_quiz(self, quiz_id):
        """Get quiz from database"""
        try:
            from django.core.cache import cache
            import asyncio

            def _get():
                try:
                    quiz = Quiz.objects.get(id=quiz_id)
                    return {
                        'id': quiz.id,
                        'title': quiz.title,
                        'questions': quiz.questions,
                        'duration': quiz.duration
                    }
                except Quiz.DoesNotExist:
                    return None

            return await asyncio.to_thread(_get)
        except Exception as e:
            print(f"Error fetching quiz: {e}")
            return None

    async def get_or_create_session(self, quiz_id, room_id, user1_name, user2_name):
        """Get or create competitive session"""
        import asyncio

        def _create():
            try:
                print(f"Getting or creating session: quiz_id={quiz_id}, room_id={room_id}, user1={user1_name}, user2={user2_name}")
                quiz = Quiz.objects.get(id=quiz_id)
                session, created = CompetitiveSession.objects.get_or_create(
                    room_id=room_id,
                    defaults={
                        'quiz': quiz,
                        'user1_name': user1_name,
                        'user2_name': user2_name,
                        'status': 'active',
                        'quiz_start_time': timezone.now()
                    }
                )
                print(f"Session {'CREATED' if created else 'FOUND'}: session_id={session.id}, room_id={session.room_id}")
                return session
            except Exception as e:
                print(f"Error creating session: {e}")
                import traceback
                traceback.print_exc()
                return None

        return await asyncio.to_thread(_create)

    async def create_participation(self, session, participant_name, answers, submission_time, is_user1):
        """Create participation record"""
        import asyncio

        def _create():
            try:
                if not session:
                    print(f"ERROR: No session found for {participant_name}")
                    return None
                print(f"Creating participation for {participant_name} in session {session.id}")
                participation = Participation.objects.create(
                    session=session,
                    participant_name=participant_name,
                    is_user1=is_user1,
                    answers=answers,
                    submission_time=submission_time,
                    submitted_at=timezone.now()
                )
                print(f"✅ Participation created: ID={participation.id}, Name={participant_name}, Session={session.id}")
                
                # Verify it was saved
                count = Participation.objects.filter(session=session).count()
                print(f"   Verification: Session {session.id} now has {count} total participations")
                
                return participation
            except Exception as e:
                print(f"❌ Error creating participation for {participant_name}: {e}")
                import traceback
                traceback.print_exc()
                return None

        return await asyncio.to_thread(_create)

    async def calculate_score(self, participation):
        """Calculate score based on correct answers"""
        import asyncio

        def _calculate():
            try:
                if not participation:
                    print("   ⚠️ No participation object")
                    return 0
                    
                if not participation.session:
                    print("   ⚠️ Participation has no session")
                    return 0
                
                quiz = participation.session.quiz
                questions = quiz.questions if quiz else []
                correct_count = 0

                print(f"   Scoring: {len(questions)} questions, {len(participation.answers)} answers provided")

                for i, answer in enumerate(participation.answers):
                    if i < len(questions):
                        correct_answer = questions[i].get('correct_answer', -1)
                        if answer == correct_answer:
                            correct_count += 1
                            print(f"     Q{i+1}: ✓ (answer={answer})")
                        else:
                            print(f"     Q{i+1}: ✗ (answer={answer}, correct={correct_answer})")

                score = (correct_count / len(questions) * 100) if questions else 0
                participation.score = int(score)
                participation.save()
                
                print(f"   Final score: {correct_count}/{len(questions)} = {int(score)}%")
                
                return int(score)
            except Exception as e:
                print(f"   ❌ Error calculating score: {e}")
                import traceback
                traceback.print_exc()
                return 0

        return await asyncio.to_thread(_calculate)

    async def update_session_score(self, session, score, submission_time, is_user1):
        """Update session with participant score"""
        import asyncio

        def _update():
            try:
                if not session:
                    return
                
                if is_user1:
                    session.user1_score = score
                    session.user1_submission_time = submission_time
                else:
                    session.user2_score = score
                    session.user2_submission_time = submission_time

                session.save()
            except Exception as e:
                print(f"Error updating session score: {e}")

        await asyncio.to_thread(_update)

    async def check_and_send_results(self):
        """Check if both participants have submitted and send results"""
        import asyncio

        def _check_and_prepare():
            try:
                if not self.session:
                    print("❌ No session found in check_and_send_results")
                    return None

                # Refresh session from DB
                from core.models import CompetitiveSession
                session = CompetitiveSession.objects.get(id=self.session.id)
                print(f"\n{'='*60}")
                print(f"CHECK RESULTS for Session {session.id} (room_id={session.room_id})")
                print(f"{'='*60}")

                # Check if both have submitted (participations exist)
                participation_count = Participation.objects.filter(session=session).count()
                participations = list(Participation.objects.filter(session=session))
                
                print(f"Found {participation_count} participations:")
                for idx, p in enumerate(participations, 1):
                    print(f"  {idx}. {p.participant_name}: score={p.score}%, time={p.submission_time}s, created_at={p.submitted_at}")
                
                print(f"Session state: user1={session.user1_name}({session.user1_score}%), user2={session.user2_name}({session.user2_score}%)")
                print(f"Submission times: user1={session.user1_submission_time}s, user2={session.user2_submission_time}s")
                print(f"Status: {session.status}")
                
                if participation_count == 2:
                    print("✅ Both users have submitted!")
                    
                    # Determine winner based on final scores
                    quiz_duration = session.quiz.duration if session.quiz else 60
                    
                    time1_percentage = (session.user1_submission_time / quiz_duration) * 100
                    time2_percentage = (session.user2_submission_time / quiz_duration) * 100
                    
                    time_bonus1 = max(0, (100 - time1_percentage))
                    time_bonus2 = max(0, (100 - time2_percentage))
                    
                    # Final score calculation
                    user1_final = (session.user1_score * 0.7) + (time_bonus1 * 0.3)
                    user2_final = (session.user2_score * 0.7) + (time_bonus2 * 0.3)
                    
                    print(f"\nScore calculation:")
                    print(f"  {session.user1_name}: {session.user1_score}% * 0.7 + {time_bonus1:.1f}% * 0.3 = {user1_final:.1f}%")
                    print(f"  {session.user2_name}: {session.user2_score}% * 0.7 + {time_bonus2:.1f}% * 0.3 = {user2_final:.1f}%")
                    
                    if user1_final > user2_final:
                        session.winner = session.user1_name
                        print(f"🏆 Winner: {session.user1_name}")
                    elif user2_final > user1_final:
                        session.winner = session.user2_name
                        print(f"🏆 Winner: {session.user2_name}")
                    else:
                        session.winner = 'draw'
                        print(f"🏆 Draw!")

                    session.status = 'completed'
                    session.quiz_end_time = timezone.now()
                    session.save()
                    
                    print(f"{'='*60}\n")
                    
                    return {
                        'user1_name': session.user1_name,
                        'user1_score': session.user1_score,
                        'user1_final_score': user1_final,
                        'user2_name': session.user2_name,
                        'user2_score': session.user2_score,
                        'user2_final_score': user2_final,
                        'winner': session.winner,
                        'submission_times': {
                            'user1': session.user1_submission_time,
                            'user2': session.user2_submission_time
                        }
                    }
                else:
                    print(f"⏳ Waiting for submissions. Current: {participation_count}/2")
                    print(f"{'='*60}\n")
                    return None
            except Exception as e:
                print(f"❌ Error checking results: {e}")
                import traceback
                traceback.print_exc()
                return None

        results = await asyncio.to_thread(_check_and_prepare)

        if results:
            print(f"Sending results: {results}")
            results_msg = {
                'type': 'quiz_results',
                'data': results
            }

            # Send to both participants
            await self.send(json.dumps(results_msg))
            if self.partner:
                try:
                    await self.partner.send(json.dumps(results_msg))
                except Exception as e:
                    print(f"Error sending to partner: {e}")
        else:
            print("Results not ready yet")
